import { type Media, MediaReadyState } from '@videojs/media';
import { type AnySlice, combine, createStore, defineSlice } from '@videojs/store';
import { describe, expect, expectTypeOf, it, vi } from 'vite-plus/test';

import { playbackFeature } from '../playback';
import { createFakeMedia } from './fake-media';

function createPlaybackMedia() {
  return createFakeMedia({
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    paused: true,
    ended: false,
    currentTime: 0,
    duration: 10,
    seeking: false,
    loop: false,
    src: '',
    currentSrc: '',
    readyState: Number(MediaReadyState.HAVE_ENOUGH_DATA),
    load: () => {},
  });
}

describe('playbackFeature', () => {
  it('syncs playback state on attach', () => {
    const media = createPlaybackMedia();

    media.paused = false;
    media.currentTime = 5;

    const store = createStore<{ media: Media }>()(playbackFeature);

    store.attach({ media });

    expect(store.state.paused).toBe(false);
    expect(store.state.started).toBe(true);
    expect(store.state.waiting).toBe(false);
  });

  it('reports waiting until currentTime advances', () => {
    const media = createPlaybackMedia();
    const store = createStore<{ media: Media }>()(playbackFeature);

    store.attach({ media });

    media.paused = false;
    media.readyState = MediaReadyState.HAVE_CURRENT_DATA;
    media.emit('waiting');

    expect(store.state.waiting).toBe(true);

    media.currentTime = 0.5;
    media.emit('timeupdate');

    expect(store.state.waiting).toBe(false);
  });

  it('forwards actions to the media', () => {
    const media = createPlaybackMedia();
    const store = createStore<{ media: Media }>()(playbackFeature);

    store.attach({ media });

    expect(store.state.togglePaused()).toBe(true);
    expect(media.play).toHaveBeenCalledTimes(1);

    store.state.pause();

    expect(media.pause).toHaveBeenCalledTimes(1);
  });

  it('composes with a platform slice that needs a container', () => {
    type PlatformTarget = { media: Media; container: { fullscreen: boolean } | null };

    const containerSlice = defineSlice<PlatformTarget>()({ name: 'container', state: () => ({}) });
    const slice = combine(playbackFeature, containerSlice);
    const store = createStore<PlatformTarget>()(slice);

    store.attach({ media: createPlaybackMedia(), container: null });

    expectTypeOf(slice).toExtend<AnySlice<PlatformTarget>>();
    expect(store.state.paused).toBe(true);
  });
});
