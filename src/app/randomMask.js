// "Random mask": picks a combination of effect and overlay masks at a chosen strength. Recipes
// give a rough first guess; App.randomizeMasks then renders each candidate small and keeps the
// first one whose measured change (strengthMeter.js) falls inside the band for that strength.

import { EFFECT_CATEGORIES, EFFECTS, intensityParams } from '../gl/effects.js';
import { PATTERNS } from '../gl/patterns.js';
import { effectLayer, maskLayer, patternLayer } from '../core/model.js';
import { PRESET_MASKS } from '../masks/maskData.js';

export const RANDOM_LEVELS = [
  { id: 'light', label: 'Light', note: 'Easy to recognise, still beats a plain search' },
  { id: 'medium', label: 'Medium', note: 'The usual round' },
  { id: 'strong', label: 'Strong', note: 'Hard round' },
];

export const RANDOM_KINDS = [
  ...EFFECT_CATEGORIES.filter((category) => category.id !== 'heavy'),
  { id: 'overlays', label: 'Overlays (patterns, classic masks)' },
];

/**
 * Accepted change score (see strengthMeter.js) per level, calibrated on 150 random candidates:
 * each band is roughly the middle half of what that level's recipes produce, and "medium"
 * brackets the hand-tuned recipes of the first version of this button.
 */
export const STRENGTH_BANDS = {
  light: [0.15, 0.33],
  medium: [0.33, 0.55],
  strong: [0.55, 0.82],
};

// Mostly recolour the picture; too light on their own, fine next to something else.
const COLOUR_ONLY = new Set(['duotone', 'thermal', 'colorShift', 'posterize']);
// Effects that bend whatever is under them: they go above an overlay so they warp it too.
const WARPS_OVERLAY = new Set(['glass', 'water', 'warp']);

const usable = EFFECTS.filter((effect) => !effect.hidden && effect.cat !== 'heavy' && effect.strength > 0);
const POOLS = {
  light: usable.filter((effect) => effect.strength === 1 && !COLOUR_ONLY.has(effect.id)),
  colour: usable.filter((effect) => COLOUR_ONLY.has(effect.id)),
  secondary: usable.filter((effect) => effect.strength === 1),
  medium: usable.filter((effect) => effect.strength === 2),
  strong: usable.filter((effect) => effect.strength === 3),
};

// [pool, min factor, max factor] per effect; `overlay` is an opacity range.
const RECIPES = {
  light: [
    { weight: 3, effects: [['light', 0.8, 1.2]] },
    { weight: 3, effects: [['medium', 0.45, 0.7]] },
    { weight: 1, effects: [['strong', 0.3, 0.45]] },
    { weight: 2, effects: [], overlay: [0.4, 0.55] },
    { weight: 1, effects: [['colour', 0.8, 1.1]], overlay: [0.3, 0.4] },
  ],
  medium: [
    { weight: 4, effects: [['medium', 0.8, 1.15]] },
    { weight: 2, effects: [['strong', 0.5, 0.7]] },
    { weight: 2, effects: [['medium', 0.6, 0.85], ['secondary', 0.6, 1]] },
    { weight: 2, effects: [['light', 0.9, 1.3]], overlay: [0.35, 0.5] },
    { weight: 1, effects: [['colour', 0.7, 1]], overlay: [0.55, 0.7] },
    { weight: 1, effects: [], overlay: [0.6, 0.72] },
  ],
  strong: [
    { weight: 3, effects: [['strong', 0.9, 1.3]] },
    { weight: 2, effects: [['medium', 1.3, 1.7]] },
    { weight: 2, effects: [['medium', 0.9, 1.2]], overlay: [0.4, 0.55] },
    { weight: 2, effects: [['strong', 0.7, 0.9], ['secondary', 0.8, 1.1]] },
    { weight: 1, effects: [['medium', 0.9, 1.1], ['medium', 0.7, 0.9]] },
    { weight: 1, effects: [['colour', 0.9, 1.2]], overlay: [0.72, 0.85] },
  ],
};

const between = (min, max) => min + Math.random() * (max - min);
const pickAny = (list) => list[Math.floor(Math.random() * list.length)];

// The last few picks, so pressing the button again does not keep showing the same effect.
const recent = [];

function pick(list) {
  const fresh = list.filter((entry) => !recent.includes(entry.id ?? entry.name));

  return pickAny(fresh.length ? fresh : list);
}

export function rememberPicks(plan) {
  const ids = [...plan.effects.map(([definition]) => definition.id), plan.overlay?.pattern?.id ?? plan.overlay?.preset?.name].filter(Boolean);

  recent.push(...ids);
  recent.splice(0, Math.max(0, recent.length - 8));
}

function weighted(list) {
  let roll = Math.random() * list.reduce((sum, entry) => sum + entry.weight, 0);

  for (const entry of list) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry;
    }
  }

  return list[0];
}

/**
 * Chooses what to add, or null when the ticked kinds leave nothing to choose from.
 * `kinds` are RANDOM_KINDS ids; `allowOverlay` false leaves overlay masks out.
 */
export function planRandomMask({ level = 'medium', kinds = RANDOM_KINDS.map((kind) => kind.id), allowOverlay = true } = {}) {
  const overlays = allowOverlay && kinds.includes('overlays');
  const pools = Object.fromEntries(Object.entries(POOLS).map(([id, pool]) => [id, pool.filter((effect) => kinds.includes(effect.cat))]));
  const feasible = (RECIPES[level] ?? RECIPES.medium).filter(
    (recipe) => (!recipe.overlay || overlays) && (recipe.effects.length || recipe.overlay) && recipe.effects.every(([pool]) => pools[pool].length)
  );

  if (!feasible.length) {
    // The ticked kinds don't fit any recipe: one effect from whatever is allowed, pushed to the level.
    const any = usable.filter((effect) => kinds.includes(effect.cat));
    const factor = { light: 0.6, medium: 1, strong: 1.5 }[level] ?? 1;

    if (any.length) {
      return { effects: [[pick(any), factor]], overlay: null };
    }

    return overlays ? planOverlay({ light: [0.4, 0.55], medium: [0.6, 0.72], strong: [0.75, 0.85] }[level] ?? [0.6, 0.72]) : null;
  }

  const recipe = weighted(feasible);
  const effects = [];

  for (const [pool, min, max] of recipe.effects) {
    // Never the same effect twice in one combination.
    const options = pools[pool].filter((effect) => !effects.some(([chosen]) => chosen.id === effect.id));

    effects.push([pick(options.length ? options : pools[pool]), between(min, max)]);
  }

  return { effects, overlay: recipe.overlay ? planOverlay(recipe.overlay).overlay : null };
}

function planOverlay(range) {
  const opacity = between(...range);

  return {
    effects: [],
    overlay: Math.random() < 0.6 ? { kind: 'pattern', pattern: pick(PATTERNS), opacity } : { kind: 'preset', preset: pick(PRESET_MASKS), opacity },
  };
}

/** `region` = { rect, points? } in document pixels limits the effect to one collage piece. */
export function regionOptions(region) {
  if (!region) {
    return {};
  }

  const { rect, points } = region;

  if (!points) {
    return { coverage: 'rect', rect };
  }

  return {
    coverage: 'polygon',
    rect,
    points: points.map((value, index) => (index % 2 === 0 ? (value - rect.x) / rect.width - 0.5 : (value - rect.y) / rect.height - 0.5)),
  };
}

function buildEffect(doc, definition, factor, region) {
  const layer = effectLayer(doc, definition.id, { params: intensityParams(definition, factor), ...regionOptions(region) });

  // Move the centre of radial effects off the middle a little so they don't all look alike.
  return definition.centered ? { ...layer, center: { x: between(-0.2, 0.2), y: between(-0.2, 0.2) } } : layer;
}

/**
 * Turns a plan into layers for `doc`, bottom first. `loadPreset(preset)` resolves to the asset
 * of a classic mask picture. With `region` (a collage piece) the effects only cover that area.
 */
export async function buildRandomMask(doc, plan, loadPreset, region = null) {
  const built = await buildLayers(doc, plan, loadPreset, region);

  if (region?.points) {
    // Every layer, overlays included, stays inside its collage piece.
    built.layers = built.layers.map((layer) => ({ ...layer, clip: { piece: region.piece, points: region.points } }));
  }

  return built;
}

async function buildLayers(doc, plan, loadPreset, region) {
  const effects = plan.effects.map(([definition, factor]) => buildEffect(doc, definition, factor, region));
  const names = plan.effects.map(([definition]) => definition.name);

  if (!plan.overlay) {
    return { layers: effects, names };
  }

  const { kind, opacity } = plan.overlay;
  const overlay =
    kind === 'pattern'
      ? patternLayer(doc, plan.overlay.pattern.id, { opacity })
      : maskLayer(doc, await loadPreset(plan.overlay.preset), { name: plan.overlay.preset.name, opacity });
  const overlayName = `${kind === 'pattern' ? plan.overlay.pattern.name : plan.overlay.preset.name} overlay`;
  const warpsOverlay = plan.effects.some(([definition]) => WARPS_OVERLAY.has(definition.cat));

  return warpsOverlay
    ? { layers: [overlay, ...effects], names: [overlayName, ...names] }
    : { layers: [...effects, overlay], names: [...names, overlayName] };
}

/** How far `score` is outside the band for `level` (0 when inside). */
export function bandDistance(level, score) {
  const [min, max] = STRENGTH_BANDS[level] ?? STRENGTH_BANDS.medium;

  return score < min ? min - score : score > max ? score - max : 0;
}
