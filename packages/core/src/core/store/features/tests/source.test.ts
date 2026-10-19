import { type Media, MediaReadyState } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it, vi } from 'vite-plus/test';

import { sourceFeature } from '../source';
import { createFakeMedia } from './fake-media';

function createSourceMedia() {
  return createFakeMedia({
    src: '',
    currentSrc: '',
    readyState: Number(MediaReadyState.HAVE_NOTHING),
    load: vi.fn(),
  });
}

describe('sourceFeature', () => {
  it('syncs source and canPlay on canplay', () => {
    const media = createSourceMedia();
    const store = createStore<{ media: Media }>()(sourceFeature);

    store.attach({ media });

    expect(store.state.source).toBeNull();
    expect(store.state.canPlay).toBe(false);

    media.currentSrc = 'https://example.com/video.m3u8';
    media.readyState = MediaReadyState.HAVE_ENOUGH_DATA;
    media.emit('canplay');

    expect(store.state.source).toBe('https://example.com/video.m3u8');
    expect(store.state.canPlay).toBe(true);
  });

  it('loads a new source on the media', () => {
    const media = createSourceMedia();
    const store = createStore<{ media: Media }>()(sourceFeature);

    store.attach({ media });
    store.state.loadSource('https://example.com/next.mp4');

    expect(media.src).toBe('https://example.com/next.mp4');
    expect(media.load).toHaveBeenCalledTimes(1);
  });
});
