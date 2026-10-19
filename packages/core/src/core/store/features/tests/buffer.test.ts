import type { Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { bufferFeature } from '../buffer';
import { createFakeMedia, createTimeRanges } from './fake-media';

describe('bufferFeature', () => {
  it('serializes ranges on attach and on progress', () => {
    const media = createFakeMedia({
      buffered: createTimeRanges([[0, 5]]),
      seekable: createTimeRanges([[0, 10]]),
    });

    const store = createStore<{ media: Media }>()(bufferFeature);

    store.attach({ media });

    expect(store.state.buffered).toEqual([[0, 5]]);
    expect(store.state.seekable).toEqual([[0, 10]]);

    media.buffered = createTimeRanges([
      [0, 5],
      [8, 9],
    ]);
    media.emit('progress');

    expect(store.state.buffered).toEqual([
      [0, 5],
      [8, 9],
    ]);
  });
});
