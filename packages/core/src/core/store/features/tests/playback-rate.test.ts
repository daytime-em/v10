import type { Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { playbackRateFeature } from '../playback-rate';
import { createFakeMedia } from './fake-media';

describe('playbackRateFeature', () => {
  it('syncs the rate on attach and on ratechange', () => {
    const media = createFakeMedia({ playbackRate: 1.5, defaultPlaybackRate: 1 });
    const store = createStore<{ media: Media }>()(playbackRateFeature);

    store.attach({ media });

    expect(store.state.playbackRate).toBe(1.5);

    media.playbackRate = 2;
    media.emit('ratechange');

    expect(store.state.playbackRate).toBe(2);
  });

  it('sets the rate on the media', () => {
    const media = createFakeMedia({ playbackRate: 1, defaultPlaybackRate: 1 });
    const store = createStore<{ media: Media }>()(playbackRateFeature);

    store.attach({ media });
    store.state.setPlaybackRate(0.5);

    expect(media.playbackRate).toBe(0.5);
  });
});
