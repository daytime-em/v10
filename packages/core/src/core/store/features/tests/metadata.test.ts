import type { Media, MediaContentData } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { setPlayerConfigValue } from '../../../feature';
import { metadataFeature } from '../metadata';
import { createFakeMedia } from './fake-media';

describe('metadataFeature', () => {
  it('syncs content data on attach and on contentdatachange', () => {
    const media = createFakeMedia<{ contentData: MediaContentData | undefined }>({
      contentData: { title: 'Intro', poster: 'intro.jpg' },
    });
    const store = createStore<{ media: Media }>()(metadataFeature);

    store.attach({ media });

    expect(store.state.title).toBe('Intro');
    expect(store.state.poster).toBe('intro.jpg');

    media.contentData = { title: 'Chapter 2' };
    media.emit('contentdatachange');

    expect(store.state.title).toBe('Chapter 2');
    expect(store.state.poster).toBe('');
  });

  it('prefers the configured title over the media title', () => {
    const media = createFakeMedia<{ contentData: MediaContentData | undefined }>({
      contentData: { title: 'From media' },
    });
    const store = createStore<{ media: Media }>()(metadataFeature);

    store.attach({ media });
    setPlayerConfigValue(store, metadataFeature.config!.title, 'From author');

    expect(store.state.title).toBe('From author');
  });
});
