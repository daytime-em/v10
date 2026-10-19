import { describe, expect, it, vi } from 'vite-plus/test';

import { type ListenTarget, listen, onEvent } from '../listen';

/** Supports `signal` but not `once`, like a hand-rolled `EventTargetLike` emitter. */
function createEmitter() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  const emitter = {
    addEventListener(type: string, listener: (event: any) => void, options?: { signal?: AbortSignal }) {
      if (options?.signal?.aborted) return;

      const set = listeners.get(type) ?? new Set();

      set.add(listener);
      listeners.set(type, set);
      options?.signal?.addEventListener('abort', () => set.delete(listener));
    },
    removeEventListener(type: string, listener: (event: any) => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, event: unknown = { type }) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  } satisfies ListenTarget & Record<string, unknown>;

  return emitter;
}

describe('listen', () => {
  it('calls the listener until cleanup', () => {
    const emitter = createEmitter();
    const listener = vi.fn();
    const cleanup = listen(emitter, 'play', listener);

    emitter.emit('play');
    cleanup();
    emitter.emit('play');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops listening when the signal aborts', () => {
    const emitter = createEmitter();
    const controller = new AbortController();
    const listener = vi.fn();

    listen(emitter, 'play', listener, { signal: controller.signal });
    controller.abort();
    emitter.emit('play');

    expect(listener).not.toHaveBeenCalled();
  });

  it('accepts DOM event targets', () => {
    const target = new EventTarget();
    const listener = vi.fn();

    listen(target, 'play', listener);
    target.dispatchEvent(new Event('play'));

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('onEvent', () => {
  it('resolves with the first event and removes its listener', async () => {
    const emitter = createEmitter();
    const pending = onEvent(emitter, 'seeked');

    emitter.emit('seeked', { type: 'seeked', id: 1 });
    emitter.emit('seeked', { type: 'seeked', id: 2 });

    await expect(pending).resolves.toEqual({ type: 'seeked', id: 1 });
    expect(emitter.count('seeked')).toBe(0);
  });

  it('rejects with the abort reason and removes its listener', async () => {
    const emitter = createEmitter();
    const controller = new AbortController();
    const pending = onEvent(emitter, 'seeked', { signal: controller.signal });

    controller.abort('superseded');

    await expect(pending).rejects.toBe('superseded');
    expect(emitter.count('seeked')).toBe(0);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const emitter = createEmitter();

    await expect(onEvent(emitter, 'seeked', { signal: AbortSignal.abort('done') })).rejects.toBe('done');
    expect(emitter.count('seeked')).toBe(0);
  });
});
