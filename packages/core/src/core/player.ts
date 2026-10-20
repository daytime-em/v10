import type { Media } from '@videojs/media';
import type { AnySlice, InferSliceSourceState, Slice } from '@videojs/store';
import type { CamelCase, Simplify, UnionToIntersection } from '@videojs/utils/types';

/**
 * What a player store attaches to. Each platform supplies its own media and container types; the web's is
 * `PlayerTarget` from `@videojs/core/dom`.
 */
export interface PlayerTarget<M extends Media = Media, Container = unknown> {
  media: M;
  container: Container | null;
}

/**
 * The target a platform-neutral feature declares. It asks only for `media`, so the feature composes into any platform's
 * store: `combine` intersects it with that platform's full target.
 */
export interface PlayerMediaTarget {
  media: Media;
}

type ConfigValue = string | null | undefined;

type ActionInput<Action> = Action extends (...args: infer Arguments) => unknown
  ? Arguments extends [infer Value]
    ? Value
    : never
  : never;

/**
 * Actions accepting text, including narrower unions such as a string enum, so a feature keeps its own value type on the
 * provider input. `null | undefined` stays mandatory because that is how a provider clears an absent input.
 */
type ConfigActionKey<State> = [State] extends [never]
  ? PropertyKey
  : {
      [Key in keyof State]-?: [ActionInput<State[Key]>] extends [ConfigValue]
        ? [null | undefined] extends [ActionInput<State[Key]>]
          ? Key
          : never
        : never;
    }[keyof State];

type ConfigStateKey<State> = [State] extends [never] ? PropertyKey : keyof State;

/**
 * Maps provider inputs to feature-owned state actions and detach-persistent keys. Pass the feature's source-state type
 * when declaring a config map so both keys are checked and each action accepts nullable text, including absent input.
 */
export type PlayerFeatureConfig<State = never> = Record<
  string,
  {
    /**
     * Source-state action applied when the input changes. It must accept the input's own value type plus `null |
     * undefined`, since an input the author omits arrives as `undefined`. A feature's own public setter qualifies when
     * it accepts that; otherwise point at a private action that does.
     */
    action: ConfigActionKey<State>;
    /** Provider-owned source-state key whose value survives media detach. */
    state: ConfigStateKey<State>;
    /** How an HTML provider element names this input, when the key's own name won't do. */
    html?: {
      /**
       * Attribute name in markup, kebab-case, for a key whose own name is taken on an element. The matching property
       * follows from it, so `content-title` is also `element.contentTitle`. Defaults to the kebab-cased key.
       */
      attribute: string;
    };
  }
>;

export type PlayerFeature<
  State,
  Derived = object,
  Config extends PlayerFeatureConfig = Record<never, never>,
  Target = PlayerMediaTarget,
> = Slice<Target, State, Derived> & {
  config?: Config;
};

export type AnyPlayerFeature<Target = any> = AnySlice<Target> & { config?: PlayerFeatureConfig };

type ConfigInputValue<Feature extends AnyPlayerFeature, Entry> = Entry extends { action: infer Action }
  ? Action extends keyof InferSliceSourceState<Feature>
    ? ActionInput<InferSliceSourceState<Feature>[Action]>
    : never
  : never;

export type InferPlayerFeatureConfig<Feature extends AnyPlayerFeature> = Feature extends {
  config?: infer Config extends PlayerFeatureConfig;
}
  ? { [Key in keyof Config]: ConfigInputValue<Feature, Config[Key]> }
  : object;

/** The same inputs under the names they go by on an HTML element. */
export type InferPlayerFeatureHtmlConfig<Feature extends AnyPlayerFeature> = Feature extends {
  config?: infer Config extends PlayerFeatureConfig;
}
  ? {
      [Key in keyof Config as HtmlPropertyKey<Key, Config[Key]>]: ConfigInputValue<Feature, Config[Key]>;
    }
  : object;

type HtmlPropertyKey<Key, Entry> = Entry extends { html: { attribute: infer Attribute extends string } }
  ? CamelCase<Attribute>
  : Key;

export type UnionPlayerConfig<Features extends readonly AnyPlayerFeature[]> = Features extends readonly []
  ? object
  : Simplify<UnionToIntersection<InferPlayerFeatureConfig<Features[number]>>>;

export type UnionPlayerHtmlConfig<Features extends readonly AnyPlayerFeature[]> = Features extends readonly []
  ? object
  : Simplify<UnionToIntersection<InferPlayerFeatureHtmlConfig<Features[number]>>>;
