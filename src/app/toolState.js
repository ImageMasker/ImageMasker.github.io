// Options of the drawing tools (brush, eraser, effect brushes, region, last text style). They are
// remembered in localStorage between visits; anything stored that is no longer valid falls back to
// the default.

import { hasEffect } from '../gl/effects.js';
import { BRUSH_TYPES } from '../raster/strokes.js';
import { TEXT_DEFAULTS } from '../raster/text.js';
import { PAINT_AMOUNT } from '../tools/BrushTool.js';
import { STAMP_DRAG_MODES } from '../tools/StampTool.js';
import { splitEmojis } from '../masks/emojiData.js';
import { ERASER_MODES, REGION_SHAPES } from '../ui/Inspector.js';

export function defaultToolState() {
  return {
    brush: { size: 10, color: '#000000', type: 'smooth', opacity: 100 },
    eraser: { mode: 'erase' },
    paint: { effectId: 'cutGlass', amounts: { blur: 14, pixelate: 1.6 } },
    region: { shape: 'rect', effectId: 'blur' },
    stamp: { emoji: '😀', size: 40, opacity: 100, angle: 0, spin: 0, style: 0, drag: 'trail', recent: [] },
    text: {},
  };
}

const number = (value, min, max, fallback) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback);
const oneOf = (value, values, fallback) => (values.includes(value) ? value : fallback);
const colour = (value, fallback) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
const oneEmoji = (value) => (typeof value === 'string' && value.length <= 16 ? splitEmojis(value)[0] : undefined);
const effect = (value, fallback) => (typeof value === 'string' && hasEffect(value) ? value : fallback);

export function restoreToolState(stored) {
  const state = defaultToolState();
  const { brush = {}, eraser = {}, paint = {}, region = {}, stamp = {}, text = {} } = stored && typeof stored === 'object' ? stored : {};

  state.brush = {
    size: number(brush.size, 1, 100, state.brush.size),
    color: colour(brush.color, state.brush.color),
    type: oneOf(brush.type, BRUSH_TYPES.map((type) => type.id), state.brush.type),
    opacity: number(brush.opacity, 1, 100, state.brush.opacity),
  };
  state.eraser.mode = oneOf(eraser.mode, ERASER_MODES.map((mode) => mode.value), state.eraser.mode);
  state.paint.effectId = effect(paint.effectId, state.paint.effectId);

  for (const [id, amount] of Object.entries(PAINT_AMOUNT)) {
    state.paint.amounts[id] = number(paint.amounts?.[id], amount.min, amount.max, state.paint.amounts[id]);
  }

  state.region = {
    shape: oneOf(region.shape, REGION_SHAPES.map((shape) => shape.value), state.region.shape),
    effectId: effect(region.effectId, state.region.effectId),
  };

  state.stamp = {
    emoji: oneEmoji(stamp.emoji) ?? state.stamp.emoji,
    size: number(stamp.size, 2, 200, state.stamp.size),
    opacity: number(stamp.opacity, 1, 100, state.stamp.opacity),
    angle: number(stamp.angle, -180, 180, state.stamp.angle),
    spin: number(stamp.spin, 0, 180, state.stamp.spin),
    style: stamp.style === 1 ? 1 : 0,
    drag: oneOf(stamp.drag, STAMP_DRAG_MODES.map((mode) => mode.value), state.stamp.drag),
    recent: Array.isArray(stamp.recent) ? stamp.recent.map(oneEmoji).filter(Boolean).slice(0, 12) : [],
  };

  for (const [key, value] of Object.entries(text && typeof text === 'object' ? text : {})) {
    if (key in TEXT_DEFAULTS && key !== 'text' && typeof value === typeof TEXT_DEFAULTS[key]) {
      state.text[key] = value;
    }
  }

  return state;
}
