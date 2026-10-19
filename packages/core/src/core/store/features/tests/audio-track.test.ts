import type { Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { audioTrackFeature } from '../audio-track';
import { createFakeMedia, FakeList } from './fake-media';

function createTrack(id: string, enabled: boolean) {
  return { id, kind: 'main', label: id.toUpperCase(), language: id, enabled };
}

describe('audioTrackFeature', () => {
  it('syncs the track list on attach and on addtrack', () => {
    const audioTracks = new FakeList([createTrack('en', true)]);
    const media = createFakeMedia({ audioTracks });
    const store = createStore<{ media: Media }>()(audioTrackFeature);

    store.attach({ media });

    expect(store.state.audioTrackList).toEqual([
      { id: 'en', kind: 'main', label: 'EN', language: 'en', enabled: true },
    ]);

    audioTracks.items.push(createTrack('fr', false));
    audioTracks.emit('addtrack');

    expect(store.state.audioTrackList).toHaveLength(2);
  });

  it('enables only the selected track', () => {
    const audioTracks = new FakeList([createTrack('en', true), createTrack('fr', false)]);
    const store = createStore<{ media: Media }>()(audioTrackFeature);

    store.attach({ media: createFakeMedia({ audioTracks }) });
    store.state.selectAudioTrack('fr');

    expect(audioTracks.items.map((track) => track.enabled)).toEqual([false, true]);
  });

  it('rebinds to a new list on loadstart and releases the old one', () => {
    const first = new FakeList([createTrack('en', true)]);
    const media = createFakeMedia({ audioTracks: first });
    const store = createStore<{ media: Media }>()(audioTrackFeature);

    store.attach({ media });

    media.audioTracks = new FakeList([createTrack('de', true)]);
    media.emit('loadstart');

    expect(store.state.audioTrackList.map((track) => track.id)).toEqual(['de']);
    expect(first.listenerCount('addtrack')).toBe(0);
  });
});
