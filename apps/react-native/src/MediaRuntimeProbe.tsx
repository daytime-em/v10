/// <reference lib="dom" />

/**
 * Experiment: does the `@videojs/media` root actually run under Hermes on RN 0.86?
 *
 * The rest of the app imports `@videojs/media` type-only, so its runtime code never loads. This loads the root for real
 * and exercises what it relies on from RN's own `Event` / `EventTarget` / `CustomEvent` / `AbortSignal` (installed
 * lazily by `setUpDOM.js` and `setUpXHR.js`): module-load constants, a `TypedEventTarget()` subclass, `{ signal }`
 * removal, `dispatchEvent`'s return value, and `bridgeEvents`.
 *
 * Results render on screen and log one line each, tagged `[media-probe]`, so they can be grepped from Metro or logcat.
 * Temporary — delete with its `App.tsx` mount and the `@videojs/media` dependency once the answer is recorded.
 */

import type * as MediaModule from '@videojs/media';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ProbeResult = { name: string; ok: true; note?: string } | { name: string; ok: false; error: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runProbe(): ProbeResult[] {
  const results: ProbeResult[] = [];

  const check = (name: string, fn: () => string | void) => {
    try {
      const note = fn();

      results.push({ name, ok: true, ...(note ? { note } : {}) });
    } catch (error) {
      results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  check('globals present', () => {
    const g = globalThis as Record<string, unknown>;
    const required = ['Event', 'EventTarget', 'CustomEvent', 'AbortController', 'AbortSignal'];
    const missing = required.filter((key) => typeof g[key] !== 'function');

    assert(missing.length === 0, `missing: ${missing.join(', ')}`);
    return (
      `HTMLMediaElement: ${typeof g.HTMLMediaElement}` +
      '\n' +
      `HTMLElement: ${typeof g.HTMLElement}` +
      '\n' +
      `HTMLVideoElement: ${typeof g.HTMLVideoElement}`
    );
  });

  // `require` rather than a static import so a module-load failure is reported here instead of red-boxing the app.
  let media: typeof MediaModule | undefined;

  check('root module loads', () => {
    media = require('@videojs/media') as typeof MediaModule;
    assert(typeof media.bridgeEvents === 'function', 'bridgeEvents not exported');
  });

  if (!media) return results;

  const { bridgeEvents, EMPTY_REMOTE, EMPTY_TEXT_TRACKS, TypedEventTarget } = media;

  check('EMPTY_TEXT_TRACKS', () => {
    assert(EMPTY_TEXT_TRACKS instanceof EventTarget, 'not an EventTarget');
    assert(EMPTY_TEXT_TRACKS.length === 0, 'length !== 0');
    assert([...EMPTY_TEXT_TRACKS].length === 0, 'iterator yielded tracks');
    assert(EMPTY_TEXT_TRACKS.getTrackById?.('x') === null, 'getTrackById !== null');
  });

  check('EMPTY_REMOTE', () => {
    let calls = 0;

    EMPTY_REMOTE.addEventListener('connect', () => calls++);
    (EMPTY_REMOTE as unknown as EventTarget).dispatchEvent(new Event('connect'));
    assert(calls === 1, `listener called ${calls} times`);
  });

  type ProbeEvents = { ping: MediaModule.EventLike };
  class ProbeTarget extends TypedEventTarget<ProbeEvents>() {}

  check('TypedEventTarget subclass dispatch', () => {
    const target = new ProbeTarget();
    const seen: Event[] = [];

    target.addEventListener('ping', (event) => seen.push(event as Event));
    const returned = target.dispatchEvent(new Event('ping'));

    assert(target instanceof EventTarget, 'subclass is not instanceof EventTarget');
    assert(seen.length === 1, `listener called ${seen.length} times`);
    assert(seen[0]!.type === 'ping', `type: ${seen[0]!.type}`);
    assert(typeof seen[0]!.timeStamp === 'number', `timeStamp: ${typeof seen[0]!.timeStamp}`);
    assert(seen[0]!.target === target, 'event.target is not the subclass instance');
    assert(returned === true, `dispatchEvent returned ${String(returned)}`);
  });

  check('dispatchEvent returns false when canceled', () => {
    const target = new ProbeTarget();

    target.addEventListener('ping', (event) => (event as Event).preventDefault());
    const returned = target.dispatchEvent(new Event('ping', { cancelable: true }));

    assert(returned === false, `dispatchEvent returned ${String(returned)}`);
  });

  check('removeEventListener', () => {
    const target = new ProbeTarget();
    let calls = 0;
    const listener = () => calls++;

    target.addEventListener('ping', listener);
    target.removeEventListener('ping', listener);
    target.dispatchEvent(new Event('ping'));
    assert(calls === 0, `listener called ${calls} times`);
  });

  check('{ signal } removes listener on abort', () => {
    const target = new ProbeTarget();
    const abort = new AbortController();
    let calls = 0;

    target.addEventListener('ping', () => calls++, { signal: abort.signal });
    target.dispatchEvent(new Event('ping'));
    abort.abort();
    target.dispatchEvent(new Event('ping'));
    assert(calls === 1, `listener called ${calls} times (expected 1)`);
  });

  check('{ signal } already aborted never registers', () => {
    const target = new ProbeTarget();
    const abort = new AbortController();

    abort.abort();
    let calls = 0;

    target.addEventListener('ping', () => calls++, { signal: abort.signal });
    target.dispatchEvent(new Event('ping'));
    assert(calls === 0, `listener called ${calls} times`);
  });

  check('bridgeEvents forwards Event', () => {
    const source = new EventTarget();
    const target = new EventTarget();
    const original = new Event('play');
    let sourceCalls = 0;
    let received: Event | undefined;

    source.addEventListener('play', () => sourceCalls++);
    target.addEventListener('play', (event) => (received = event));
    bridgeEvents(source, target);
    const returned = source.dispatchEvent(original);

    assert(received, 'target listener not called');
    assert(received !== original, 'event was not re-constructed');
    assert(received instanceof Event, 'bridged event is not an Event');
    assert(received.type === 'play', `type: ${received.type}`);
    assert(received.target === target, 'event.target is not the bridge target');
    assert(sourceCalls === 0, `source listener called ${sourceCalls} times`);
    assert(returned === true, `dispatchEvent returned ${String(returned)}`);
  });

  check('bridgeEvents preserves CustomEvent detail', () => {
    const source = new EventTarget();
    const target = new EventTarget();
    let received: Event | undefined;

    target.addEventListener('error', (event) => (received = event));
    bridgeEvents(source, target);
    source.dispatchEvent(new CustomEvent('error', { detail: { code: 4 } }));
    assert(received instanceof CustomEvent, `constructor: ${received?.constructor?.name}`);
    assert((received as CustomEvent<{ code: number }>).detail?.code === 4, 'detail lost');
  });

  check('bridgeEvents preserves Event subclass', () => {
    class ProbeEvent extends Event {}
    const source = new EventTarget();
    const target = new EventTarget();
    let received: Event | undefined;

    target.addEventListener('probe', (event) => (received = event));
    bridgeEvents(source, target);
    source.dispatchEvent(new ProbeEvent('probe'));
    assert(received instanceof ProbeEvent, `constructor: ${received?.constructor?.name}`);
  });

  check('bridgeEvents propagates cancelation', () => {
    const source = new EventTarget();
    const target = new EventTarget();

    target.addEventListener('seek', (event) => event.preventDefault());
    bridgeEvents(source, target);
    const returned = source.dispatchEvent(new Event('seek', { cancelable: true }));

    assert(returned === false, `dispatchEvent returned ${String(returned)}`);
  });

  return results;
}

function logResults(results: ProbeResult[]) {
  for (const result of results) {
    const detail = result.ok ? (result.note ?? '') : result.error;

    console.log(`[media-probe] ${result.ok ? 'PASS' : 'FAIL'} ${result.name}${detail ? ` — ${detail}` : ''}`);
  }

  const failed = results.filter((result) => !result.ok).length;

  console.log(`[media-probe] ${results.length - failed}/${results.length} passed`);
}

export function MediaRuntimeProbe({ textColor, mutedColor }: { textColor: string; mutedColor: string }) {
  const [results] = useState(() => {
    const results = runProbe();

    logResults(results);
    return results;
  });
  const failed = results.filter((result) => !result.ok).length;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: textColor }]}>
        @videojs/media runtime probe — {results.length - failed}/{results.length} passed
      </Text>
      {results.map((result) => (
        <Text key={result.name} style={[styles.row, { color: result.ok ? mutedColor : '#ef4444' }]}>
          {result.ok ? '✓' : '✗'} {result.name}
          {result.ok ? (result.note ? ` — ${result.note}` : '') : ` — ${result.error}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
    gap: 4,
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  row: {
    fontSize: 12,
    fontFamily: 'Menlo',
  },
});
