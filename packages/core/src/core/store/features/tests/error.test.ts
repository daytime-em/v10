import type { ErrorLike, Media } from '@videojs/media';
import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vite-plus/test';

import { errorFeature } from '../error';
import { createFakeMedia } from './fake-media';

describe('errorFeature', () => {
  it('reports the media error and clears it on emptied', () => {
    const media = createFakeMedia<{ error: ErrorLike | null }>({ error: null });
    const store = createStore<{ media: Media }>()(errorFeature);

    store.attach({ media });

    media.error = { code: 4, message: 'Unsupported source' };
    media.emit('error');

    expect(store.state.error).toEqual({ code: 4, message: 'Unsupported source' });

    media.emit('emptied');

    expect(store.state.error).toBeNull();
  });

  it('dismisses the error', () => {
    const media = createFakeMedia<{ error: ErrorLike | null }>({ error: { code: 2, message: 'Network' } });
    const store = createStore<{ media: Media }>()(errorFeature);

    store.attach({ media });
    media.emit('error');
    store.state.dismissError();

    expect(store.state.error).toBeNull();
  });
});
