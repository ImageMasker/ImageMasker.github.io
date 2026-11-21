const {
  BlurFilter,
  ColorMatrixFilter,
  DisplacementFilter,
  NoiseFilter,
} = PIXI;

const EFFECT_DEFINITIONS = {
  hue: {
    defaults: {
      type: 'hue',
      enabled: false,
      value: 0,
    },
    createFilter(effect) {
      if (!effect.enabled || effect.value === 0) {
        return null;
      }

      const filter = new ColorMatrixFilter();
      filter.hue(effect.value * 180, false);
      return filter;
    },
  },
  invert: {
    defaults: {
      type: 'invert',
      enabled: false,
    },
    createFilter(effect) {
      if (!effect.enabled) {
        return null;
      }

      const filter = new ColorMatrixFilter();
      filter.negative();
      return filter;
    },
  },
  blur: {
    defaults: {
      type: 'blur',
      enabled: false,
      strength: 0,
    },
    createFilter(effect) {
      if (!effect.enabled || effect.strength <= 0) {
        return null;
      }

      const filter = new BlurFilter();
      filter.strength = effect.strength;
      return filter;
    },
  },
  noiseWarp: {
    defaults: {
      type: 'noiseWarp',
      enabled: false,
      noise: 0,
      seed: 0.5,
    },
    createFilter(effect) {
      if (!effect.enabled || effect.noise <= 0) {
        return null;
      }

      const filter = new NoiseFilter();
      filter.noise = effect.noise;
      filter.seed = effect.seed ?? 0.5;
      return filter;
    },
  },
  displacement: {
    defaults: {
      type: 'displacement',
      enabled: false,
      strength: 0,
      seed: 0.5,
    },
    createFilter(effect, context = {}) {
      if (!effect.enabled || effect.strength <= 0) {
        return null;
      }

      const sprite = context.helpers?.ensureDisplacementSprite?.(context.owner, effect);

      if (!sprite) {
        return null;
      }

      return new DisplacementFilter({
        sprite,
        scale: {
          x: effect.strength,
          y: effect.strength,
        },
      });
    },
  },
};

export class EffectStack {
  constructor(initialEffects = null) {
    this.effects = [];
    this.restore(initialEffects);
  }

  restore(initialEffects = null) {
    this.effects = Object.entries(EFFECT_DEFINITIONS).map(([type, definition]) => ({
      ...definition.defaults,
      ...(initialEffects?.find((effect) => effect.type === type) ?? {}),
      type,
    }));
  }

  serialize() {
    return this.effects.map((effect) => ({ ...effect }));
  }

  getEffect(type) {
    return this.effects.find((effect) => effect.type === type) ?? null;
  }

  updateEffect(type, partialState) {
    const definition = EFFECT_DEFINITIONS[type];

    if (!definition) {
      return null;
    }

    const current = this.getEffect(type);
    const next = {
      ...definition.defaults,
      ...(current ?? {}),
      ...partialState,
      type,
    };

    if (current) {
      Object.assign(current, next);
      return current;
    }

    this.effects.push(next);
    return next;
  }

  buildFilters(context = {}) {
    const filters = [];

    for (const effect of this.effects) {
      const definition = EFFECT_DEFINITIONS[effect.type];

      if (!definition) {
        continue;
      }

      const built = definition.createFilter(effect, context);

      if (!built) {
        continue;
      }

      if (Array.isArray(built)) {
        filters.push(...built);
      } else {
        filters.push(built);
      }
    }

    return filters;
  }
}
