import type { DerivedContext, SliceConfig } from '@videojs/store';

import type { AnyPlayerFeature, PlayerFeature, PlayerFeatureConfig, PlayerMediaTarget } from './player';

type DerivedFunctions<State> = Record<string, (ctx: DerivedContext<State>) => unknown>;

type DerivedValues<Definitions extends Record<string, (...args: any[]) => unknown>> = {
  [Key in keyof Definitions]: ReturnType<Definitions[Key]>;
};

type PlayerFeatureDefinition<Target, State, Derived, Config extends PlayerFeatureConfig> = Omit<
  SliceConfig<Target, State, Derived>,
  'preserve'
> & {
  config?: Config;
};

/** Defines player features against one target type. */
export interface PlayerFeatureFactory<Target> {
  /** Define a player feature with derived state and optional configuration inputs. */
  <
    State,
    const Definitions extends DerivedFunctions<State>,
    const Config extends PlayerFeatureConfig = Record<never, never>,
  >(
    definition: Omit<PlayerFeatureDefinition<Target, State, DerivedValues<Definitions>, Config>, 'derived'> & {
      derived: Definitions;
    }
  ): PlayerFeature<State, DerivedValues<Definitions>, Config, Target>;
  /** Define a player feature with optional configuration inputs. */
  <State, const Config extends PlayerFeatureConfig = Record<never, never>>(
    definition: Omit<PlayerFeatureDefinition<Target, State, object, Config>, 'derived'> & { derived?: never }
  ): PlayerFeature<State, object, Config, Target>;
}

/**
 * Create a feature definer for one target type. Platforms bind their full target with it, so features that need more
 * than `media`, such as a container, can read it.
 */
export function createPlayerFeatureFactory<Target>(): PlayerFeatureFactory<Target> {
  return ((definition: PlayerFeatureDefinition<Target, unknown, object, PlayerFeatureConfig>) => {
    const preserved = Object.values(definition.config ?? {}).map((entry) => entry.state);

    return {
      ...definition,
      ...(preserved.length > 0 ? { preserve: preserved } : {}),
    };
  }) as PlayerFeatureFactory<Target>;
}

/**
 * Define a platform-neutral player feature. Its target holds only `media`, so the feature composes into any platform's
 * player store.
 */
export const definePlayerFeature: PlayerFeatureFactory<PlayerMediaTarget> = createPlayerFeatureFactory();

/** Merge the configuration declarations from the selected player features. */
export function combinePlayerFeatureConfigs(features: readonly AnyPlayerFeature[]): PlayerFeatureConfig {
  const definitions = features.map((feature) => feature.config ?? {});

  if (__DEV__) {
    const seen = new Set<string>();

    for (const definition of definitions) {
      for (const key of Object.keys(definition)) {
        if (seen.has(key)) {
          console.warn(`[vjs-core] duplicate config key "${key}" — later feature overwrites earlier one`);
        }

        seen.add(key);
      }
    }
  }

  return Object.assign({}, ...definitions);
}

/** Forward one configuration input through its feature-owned private action. */
export function setPlayerConfigValue(store: object, entry: PlayerFeatureConfig[string], value: unknown): void {
  const action = (store as Record<PropertyKey, unknown>)[entry.action];
  if (typeof action !== 'function') throw new TypeError(`Missing config action "${String(entry.action)}"`);

  action(value);
}
