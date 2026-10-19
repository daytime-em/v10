import { type Media, type MediaStreamType, MediaStreamTypes } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { streamTypeFeature } from '../stream-type';
import { createFakeMedia } from './fake-media';

describe('streamTypeFeature', () => {
  it('reads the media stream type and follows streamtypechange', () => {
    const media = createFakeMedia<{ streamType: MediaStreamType }>({ streamType: MediaStreamTypes.ON_DEMAND });
    const store = createStore<{ media: Media }>()(streamTypeFeature);

    store.attach({ media });

    expect(store.state.streamType).toBe(MediaStreamTypes.ON_DEMAND);

    media.streamType = MediaStreamTypes.LIVE;
    media.emit('streamtypechange');

    expect(store.state.streamType).toBe(MediaStreamTypes.LIVE);
  });

  it('falls back to duration-based detection', () => {
    const media = createFakeMedia({ currentTime: 0, duration: Number.NaN, seeking: false, loop: false });
    const store = createStore<{ media: Media }>()(streamTypeFeature);

    store.attach({ media });

    expect(store.state.streamType).toBe(MediaStreamTypes.UNKNOWN);

    media.duration = Number.POSITIVE_INFINITY;
    media.emit('durationchange');

    expect(store.state.streamType).toBe(MediaStreamTypes.LIVE);
  });
});
