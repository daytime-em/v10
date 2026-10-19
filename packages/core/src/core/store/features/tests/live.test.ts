import type { Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { liveFeature } from '../live';
import { createFakeMedia } from './fake-media';

describe('liveFeature', () => {
  it('syncs live state on attach and on targetlivewindowchange', () => {
    const media = createFakeMedia({ liveEdgeStart: 90, targetLiveWindow: 0 });
    const store = createStore<{ media: Media }>()(liveFeature);

    store.attach({ media });

    expect(store.state.liveEdgeStart).toBe(90);
    expect(store.state.targetLiveWindow).toBe(0);

    media.targetLiveWindow = Number.POSITIVE_INFINITY;
    media.emit('targetlivewindowchange');

    expect(store.state.targetLiveWindow).toBe(Number.POSITIVE_INFINITY);
  });

  it('stays NaN for media without live capability', () => {
    const store = createStore<{ media: Media }>()(liveFeature);

    store.attach({ media: createFakeMedia({}) });

    expect(store.state.liveEdgeStart).toBeNaN();
    expect(store.state.targetLiveWindow).toBeNaN();
  });
});
