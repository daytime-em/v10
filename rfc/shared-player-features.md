---
status: draft
---

# Shared Player Features Across Platforms

## Problem

Player features (`playbackFeature`, `volumeFeature`, `timeFeature`, …) are meant to be the reusable unit of player behavior, but today every one of them is DOM-bound, even when its logic only touches `Media`:

- **Location and definer.** All features live in `packages/core/src/dom/store/features/` and are built with `definePlayerFeature`, which is hardwired to `PlayerTarget` from `@videojs/core/dom`.
- **Target type.** `PlayerTarget.container` is `MediaContainer extends HTMLElement`, so no non-DOM platform can construct a `PlayerTarget`.
- **Helpers.** Features subscribe through `listen` from `@videojs/utils/dom`, which is overloaded on `HTMLMediaElement`, `Document`, and `Window`. `time` uses `onEvent` and `buffer` uses `serializeTimeRanges(TimeRanges)` from the same bucket.
- **Globals in feature bodies.** `playback` and `source` read `HTMLMediaElement.HAVE_*`, which throws where that global is missing. `volume` probes `document.createElement('video')`. `text-track` uses `instanceof HTMLElement`, `shadowRoot`, and `navigator.language`.

The media contract was already made capability-based and DOM-free so that non-DOM adapters could share it (see [media architecture](../internal/design/media/architecture.md)). The features one layer up never followed.

`@videojs/react-native` is the first platform that needs this. To compose any store at all, it currently defines its own `NativePlayerTarget`, its own slice definer, its own store types, and `nativePlaybackFeature`, which re-implements `playbackFeature` because the shared one crashes on `HTMLMediaElement` in `attach()`. Every new RN feature repeats that, and the RN player gets no feature `config` inputs because that machinery lives in `/dom`.

If nothing changes, each platform keeps a parallel copy of every feature, and those copies drift in state shape, edge-case handling, and fixes. That undermines the parity goal in the [React Native player API RFC](./react-native-player-api.md).

## Customer salience

- **Who:** Video.js maintainers first. Integrators building on both web and React Native next, since they depend on state and actions behaving the same on both platforms. Authors of custom features and custom `Media` implementations get a smaller target to satisfy.
- **How many:** Every RN player user indirectly, once RN ships. Few web users notice directly; for them the change is meant to be invisible.
- **How strongly:** Drift between platform copies of `playback`, `time`, and `volume` would show up as user-visible inconsistencies, such as `waiting` or `started` meaning different things per platform. Maintenance cost grows with every feature times every platform.

## Goals

- One implementation of each feature whose behavior is platform-independent, usable from web and React Native stores.
- Platform-specific features (fullscreen, PiP, controls activity, orientation lock, remote playback) can sit beside shared features in the same store.
- No breaking change to the web import paths, names, or feature types.
- The compiler, not review, prevents DOM from leaking back into shared features.

## Non-goals

Sharing inherently platform-bound features (they keep per-platform implementations with the same state shape), defining the RN container or native fullscreen model (RN package design), and changing the store's `Slice` or `combine` model.

## Options considered

### Option 1: Per-platform feature copies (status quo)

Each platform owns its own variants of every feature, typed against its own target.

- **Pros:** No core changes. **Cons:** Duplication and drift, which is the problem being described; RN rebuilds feature config separately. **Reversibility:** Trivial, but the cost compounds with every feature.

### Option 2: Make `PlayerTarget` generic, nothing else

Move `PlayerTarget<M, C>` to the neutral `@videojs/core` root and let each platform alias it, for example `PlayerTarget<NativeMedia, NativeContainer>`.

- **Pros:** Small, non-breaking with defaults. **Cons:** Shares no feature: they still use a DOM-pinned definer, live under `/dom`, and call DOM helpers and globals. It removes a two-field interface from RN and nothing more. **Reversibility:** Easy.

### Option 3: Platform shims (fake DOM globals in React Native)

Polyfill `HTMLMediaElement`, `document`, and similar globals in RN so the existing `/dom` features run unmodified.

- **Pros:** Little change in core. **Cons:** Breaks the capability model the media layer was built around. The shims become an implicit contract, so any new DOM call in a feature fails at runtime only on RN, and probes like `volume`'s answer for a fake element instead of the device. **Reversibility:** Hard once features silently depend on the shims.

### Option 4: Shared features target only what they use (recommended)

Shared features declare a minimal target, `{ media: Media }`, live in the runtime-neutral part of core, and only use DOM-free helpers. Platform-bound features keep declaring a full target with a `container`.

This works with the existing store model:

- `combine` intersects slice targets (`packages/store/src/core/combine.ts`), and a slice only *receives* its target.
- A `Slice<{ media: Media }>` therefore composes into any store whose target provides at least that.
- On web, the store target resolves to `{ media: Media; container: MediaContainer | null }`.
- On RN, `media` resolves to `NativeMedia` and `container` to the RN container type.

```ts
// shared, packages/core neutral root
export const playbackFeature = definePlayerFeature({ … }); // target defaults to { media: Media }

// web
createPlayer({ features: [playbackFeature, fullscreenFeature /* DOM container */] });

// react-native
createPlayer({ features: [playbackFeature, nativeFullscreenFeature /* native container */] });
```

- **Pros:** One implementation per shared feature. Each feature's real dependencies are visible in its type. Fits the capability model the media layer already uses. RN gets feature `config` support with no extra work.
- **Cons:** One-time refactor across core and utils. The feature-definition types gain a target type parameter, which makes their signatures harder to read. The `MediaEvents` contract becomes load-bearing for every platform's `Media`.
- **Reversibility:** Moderately easy. Web keeps its names through `/dom` re-exports, so pulling a feature back under `/dom` doesn't affect users.

## Recommendation

Adopt Option 4, under these rules.

### 1. Neutral home and definer

- Shared features move to the runtime-neutral part of `@videojs/core`. Its `tsconfig.json` has no DOM lib.
- `definePlayerFeature`, `PlayerFeature`, `AnyPlayerFeature`, and `PlayerFeatureConfig` move with them.
- These types gain a target type parameter that defaults to `{ media: Media }`. `PlayerTarget` becomes `PlayerTarget<M extends Media = Media, C = unknown>` there.
- `@videojs/core/dom` re-exports the same names, with its container type filled in, so existing web imports and types keep working.

### 2. Shared features use only the media contract

- `listen` and `onEvent` move to the `@videojs/utils` root with unchanged bodies, typed on a structural target (`addEventListener`/`removeEventListener` taking `{ signal?: AbortSignal }`) instead of DOM `EventTarget`. Feature call sites stay the same, and `@videojs/utils/dom` keeps its DOM-overloaded `listen` as a typed wrapper. The runtime isn't the obstacle: React Native polyfills `EventTarget` (from 0.86's `setUpDOM`, unflagged), so the existing body already runs there. The types are: RN declares no `EventTarget` global, and `Media` is `EventTargetLike`, so custom media (including RN's hand-rolled emitter) need not be a real `EventTarget`.
- Range and readiness values use the contract's own types: `TimeRangeLike`, and `MediaReadyState` from `@videojs/media`.
- Features keep narrowing with `isMediaXCapable(media)` predicates, which already live in the neutral `@videojs/media` root.

### 3. Platform detection belongs to `Media`, not features

If availability depends on the environment, the `Media` implementation reports it and the feature reads it. Examples are the volume support probe, AirPlay availability, and fullscreen support. Web's DOM media hosts do the browser probing, and `ReactNativeMedia` asks the native module. A shared feature never touches `document`, `navigator`, or platform globals.

### 4. The event contract is the cross-platform API

Shared features listen for `MediaEvents` names with HTML media semantics, such as `timeupdate`, `waiting`, and `emptied`. A platform's `Media` must emit those events with the same meaning before the corresponding shared feature can be used there. Missing events are an adapter gap, not a reason to fork the feature.

### 5. Platform-bound features stay per-platform

`controls`, `fullscreen`, `pip`, `orientation-lock`, and `remote-playback` depend on a container or on platform presentation APIs. They stay under each platform's bindings and produce the same state shape. They may share small pure helpers, such as the controls idle-timer logic, but not the feature itself. `text-track` is split: neutral track-selection logic, with track discovery and locale source supplied by the platform.

### Initial classification

| Classification | Features | Blocker |
| --- | --- | --- |
| Shared, helpers only | `buffer`, `error`, `live`, `playback-rate`, `stream-type`, `time`, `metadata` | `@videojs/utils/dom` helpers (`listen`, `onEvent`, `serializeTimeRanges`) |
| Shared, one leak each | `playback`, `source`, `volume` | `HTMLMediaElement.HAVE_*`, or the `document` volume probe |
| Shared, verify | `audio-track`, `quality` | Confirm they only rely on `AudioTrackListLike` / `VideoRenditionListLike` behavior |
| Split | `text-track` | `<track>` discovery, `shadowRoot`, `navigator.language` |
| Per-platform | `controls`, `fullscreen`, `pip`, `orientation-lock`, `remote-playback` | Container and presentation APIs |

### Enforcement

Shared features compile without the DOM lib. The neutral core config still includes `WebWorker` (`EventTarget`, `AddEventListenerOptions`), which RN lacks, so they should also typecheck under a config close to RN's `lib: ["ESNext"]`. Each shared feature gets a test against an in-memory `TypedEventTarget` media host, which doubles as the reference for what a platform `Media` must satisfy.

## Compatibility and migration

- **Web users:** No change. Names, import paths (`@videojs/core/dom`, and the `@videojs/react` / `@videojs/html` re-exports), and feature state shapes stay the same. `PlayerTarget` defaults keep existing annotations valid.
- **Custom feature and `Media` authors:** Existing `/dom` features keep working and can opt into a narrower target to become cross-platform. Off the web, the event contract becomes what shared features rely on.
- **Order:** Features move one at a time, each with its `/dom` re-export, so the migration can stop at any point without breaking anything. `playback` is the natural first one because it retires `nativePlaybackFeature`. It only becomes usable on RN once `ReactNativeMedia` reports seek and source capability and emits the standard events. Until then, RN keeps its variant.

## Open questions

- **Platform-specific inputs.** Shared feature `config` keys are declared once. Should a platform be able to hide a key that has no meaning there, or should every shared input be meaningful everywhere?
- **Relying on RN's `EventTarget` polyfill.** Should RN media switch from its hand-rolled emitter to `TypedEventTarget()`? That needs ambient `Event`/`EventTarget` value types in the RN package, real `Event` instances (RN's `dispatchEvent` rejects anything else), a minimum `react-native` peer version instead of `*`, and confirmation that the RN Jest preset installs the polyfill.
- **Volume availability.** Should it be a property on `MediaVolumeCapability`, or a separate capability, given iOS Safari is the main reason it exists?
- **Store aliases.** Should `PlayerStore` / `AnyPlayerStore` also become target-generic in the neutral root, letting RN drop `NativePlayerStore`, or stay per-platform?
- **Package layout.** Is the neutral `@videojs/core` root the right home, or should shared features get a dedicated export such as `@videojs/core/features`?

## Success measures

- Every shared-row feature compiles without the DOM lib and passes against a non-DOM media host.
- `@videojs/react-native` composes at least `playback` from core and deletes `nativePlaybackFeature`.
- Web public exports are unchanged, and new features default to the shared location unless they need a container or platform API.

## Final decision

_(Completed after review)_

**Decision:**
**Rationale:**
**Date:**

## See also

- [React Native player API RFC](./react-native-player-api.md): the parity goal this supports.
- [`.agents/plans/react-native/media-contract-feature-reuse.md`](../.agents/plans/react-native/media-contract-feature-reuse.md): earlier audit and task list for the shared-feature prerequisites.
