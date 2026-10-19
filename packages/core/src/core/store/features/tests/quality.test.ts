import type { Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { qualityFeature } from '../quality';
import { createFakeMedia, FakeList } from './fake-media';

function createRendition(id: string, height: number, active = false) {
  return {
    id,
    width: undefined,
    height,
    bitrate: undefined,
    frameRate: undefined,
    codec: undefined,
    selected: false,
    active,
  };
}

describe('qualityFeature', () => {
  it('syncs renditions and the active one on attach and on activechange', () => {
    const videoRenditions = new FakeList([createRendition('low', 360, true), createRendition('high', 1080)]);
    const store = createStore<{ media: Media }>()(qualityFeature);

    store.attach({ media: createFakeMedia({ videoRenditions }) });

    expect(store.state.videoRenditionList).toHaveLength(2);
    expect(store.state.activeVideoRendition?.id).toBe('low');

    videoRenditions.items[0]!.active = false;
    videoRenditions.items[1]!.active = true;
    videoRenditions.emit('activechange');

    expect(store.state.activeVideoRendition?.id).toBe('high');
  });

  it('selects a rendition by value and returns to auto', () => {
    const videoRenditions = new FakeList([createRendition('low', 360), createRendition('high', 1080)]);
    const store = createStore<{ media: Media }>()(qualityFeature);

    store.attach({ media: createFakeMedia({ videoRenditions }) });
    store.state.selectVideoRendition('high');

    expect(videoRenditions.selectedIndex).toBe(1);

    store.state.selectVideoRendition('auto');

    expect(videoRenditions.selectedIndex).toBe(-1);
  });
});
