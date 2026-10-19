import type { EventLike, Media, TimeRangeLike } from '@videojs/media';

// `any` so the emitter satisfies `EventTargetLike`'s typed listener signatures; callback parameters are checked
// strictly, and no narrower type fits every event map.
type Listener = (event: any) => void;

/**
 * Map-backed emitter that honors `signal` but not `once`, like React Native's hand-rolled media emitter. Shared
 * features must work against it without DOM `EventTarget`.
 */
export class FakeEmitter {
  #listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener, options?: { signal?: AbortSignal }): void {
    const signal = options?.signal;
    if (signal?.aborted) return;

    let listeners = this.#listeners.get(type);

    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }

    listeners.add(listener);
    signal?.addEventListener('abort', () => listeners.delete(listener));
  }

  removeEventListener(type: string, listener: Listener): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: EventLike): boolean {
    for (const listener of [...(this.#listeners.get(event.type) ?? [])]) listener(event);

    return true;
  }

  /** Dispatch a bare event of `type`. */
  emit(type: string): void {
    this.dispatchEvent({ type, timeStamp: 0 });
  }

  listenerCount(type: string): number {
    return this.#listeners.get(type)?.size ?? 0;
  }
}

export type FakeMedia<Fields extends object = object> = FakeEmitter & Media & Fields;

/**
 * Create an in-memory media host. `fields` supplies whichever capabilities a test needs; they stay writable so a test
 * can change them before emitting the matching event.
 */
export function createFakeMedia<Fields extends object>(fields: Fields): FakeMedia<Fields> {
  // SAFETY: `FakeEmitter` provides the `EventTargetLike` half of `Media` and `play` the rest; `fields` is merged as-is.
  return Object.assign(new FakeEmitter(), { play: async () => {} }, fields) as FakeMedia<Fields>;
}

export function createTimeRanges(ranges: Array<[number, number]>): TimeRangeLike {
  return {
    length: ranges.length,
    start: (index) => ranges[index]![0],
    end: (index) => ranges[index]![1],
  };
}

/** An iterable track or rendition list. Tests cast it to the specific list contract they need. */
export class FakeList<Item> extends FakeEmitter {
  items: Item[];
  selectedIndex = -1;

  constructor(items: Item[]) {
    super();
    this.items = items;
  }

  get length(): number {
    return this.items.length;
  }

  [Symbol.iterator](): Iterator<Item> {
    return this.items.values();
  }
}
