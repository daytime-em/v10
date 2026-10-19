import { type Media, MediaReadyState } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it, vi } from 'vite-plus/test';

import { timeFeature } from '../time';
import { createFakeMedia, createTimeRanges } from './fake-media';

function createTimeMedia() {
  return createFakeMedia({
    currentTime: 0,
    duration: 10,
    seeking: false,
    loop: false,
    src: '',
    currentSrc: '',
    readyState: Number(MediaReadyState.HAVE_METADATA),
    load: () => {},
  });
}

describe('timeFeature', () => {
  it('syncs time state on attach and on durationchange', () => {
    const media = createTimeMedia();

    media.currentTime = 3;

    const store = createStore<{ media: Media }>()(timeFeature);

    store.attach({ media });

    expect(store.state.currentTime).toBe(3);
    expect(store.state.duration).toBe(10);

    media.duration = 20;
    media.emit('durationchange');

    expect(store.state.duration).toBe(20);
  });

  it('resolves live duration from the seekable end', () => {
    const media = Object.assign(createTimeMedia(), {
      duration: Number.POSITIVE_INFINITY,
      buffered: createTimeRanges([]),
      seekable: createTimeRanges([[0, 42]]),
    });

    const store = createStore<{ media: Media }>()(timeFeature);

    store.attach({ media });

    expect(store.state.duration).toBe(42);
  });

  it('seeks and settles on seeked without leaving a listener behind', async () => {
    const media = createTimeMedia();
    const store = createStore<{ media: Media }>()(timeFeature);

    store.attach({ media });

    const listeners = media.listenerCount('seeked');
    const pending = store.state.seek(15);

    expect(store.state.seeking).toBe(true);
    expect(media.currentTime).toBe(10);

    media.emit('seeked');

    await expect(pending).resolves.toBe(10);
    expect(media.listenerCount('seeked')).toBe(listeners);
  });

  it('waits for loadedmetadata before seeking', async () => {
    const media = createTimeMedia();

    media.readyState = MediaReadyState.HAVE_NOTHING;

    const store = createStore<{ media: Media }>()(timeFeature);

    store.attach({ media });

    const pending = store.state.seek(4);

    expect(media.currentTime).toBe(0);

    media.readyState = MediaReadyState.HAVE_METADATA;
    media.emit('loadedmetadata');
    await vi.waitFor(() => expect(media.currentTime).toBe(4));
    media.emit('seeked');

    await expect(pending).resolves.toBe(4);
  });
});
