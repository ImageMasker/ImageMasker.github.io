// The document is plain immutable data: { width, height, layers: [bottom ... top] }.
// Every edit produces a new document object that shares the untouched layers, which makes
// undo/redo a matter of keeping references.

import { defaultParams, getEffect, normalizeParams } from '../gl/effects.js';
import { getPattern } from '../gl/patterns.js';
import { EMOJI_MASK } from '../masks/emojiData.js';
import { DEVICE_STYLE, isCustomEmoji } from '../raster/emojiArt.js';
import { normalizeRepeat } from '../raster/repeat.js';
import { arrowBounds, arrowEnds, distanceToArrow, headLength } from '../raster/shapes.js';
import { measureText, TEXT_DEFAULTS } from '../raster/text.js';
import { apply, invert, layerAxes, layerBounds, layerMatrix, pointInPolygon } from './geometry.js';

let counter = 0;

export function uid(prefix = 'layer') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createDoc(width, height) {
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), layers: [] };
}

function baseLayer(type, name) {
  return {
    id: uid(),
    type,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    rotation: 0,
    skewX: 0,
    skewY: 0,
  };
}

export function zoomFactor(zoom) {
  return 4 ** ((Number(zoom) - 50) / 50);
}

/** Random tilt + skew applied to new overlay masks so they are harder to subtract. */
function randomDeform() {
  return {
    rotation: ((Math.random() * 4 - 2) * Math.PI) / 180,
    skewX: Math.random() / 5 - 0.1,
    skewY: Math.random() / 5 - 0.1,
  };
}

export function imageLayer(doc, asset, { name = 'Image', base = false, rect = null } = {}) {
  let box = rect;

  if (!box) {
    const scale = base ? 1 : Math.min(doc.width / asset.width, doc.height / asset.height, 1);
    const width = base ? doc.width : Math.max(1, Math.round(asset.width * scale));
    const height = base ? doc.height : Math.max(1, Math.round(asset.height * scale));

    box = { x: (doc.width - width) / 2, y: (doc.height - height) / 2, width, height };
  }

  return {
    ...baseLayer('image', name),
    assetId: asset.id,
    base,
    locked: base,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    w: box.width,
    h: box.height,
  };
}

const MASK_FX = { hue: 0, invert: false, blur: 0, noise: 0, warp: 0, warpSeed: 0.5 };

export function maskLayer(doc, asset, { name = 'Mask', opacity = 0.75, zoom = 55, deform = true, tile = false, repeat = null } = {}) {
  const fit = Math.max(doc.width / asset.width, doc.height / asset.height);
  const factor = fit * zoomFactor(zoom);

  return {
    ...baseLayer('mask', name),
    ...MASK_FX,
    ...(deform ? randomDeform() : {}),
    source: 'asset',
    assetId: asset.id,
    tile,
    // { rows, size, stagger }: drawn small and repeated in rows like the flag masks (raster/repeat.js).
    repeat: normalizeRepeat(repeat),
    zoom,
    natW: asset.width * fit,
    natH: asset.height * fit,
    opacity,
    x: doc.width / 2,
    y: doc.height / 2,
    w: asset.width * factor,
    h: asset.height * factor,
  };
}

export function patternLayer(doc, patternId, { opacity = 0.75, params = null, deform = true } = {}) {
  const definition = getPattern(patternId);
  const side = Math.max(doc.width, doc.height);

  return {
    ...baseLayer('mask', definition.name),
    ...MASK_FX,
    ...(deform ? randomDeform() : {}),
    source: 'pattern',
    patternId: definition.id,
    params: normalizeParams(definition, params ?? defaultParams(definition)),
    seed: Math.random() * 100,
    zoom: 50,
    natW: side,
    natH: side,
    opacity,
    x: doc.width / 2,
    y: doc.height / 2,
    w: side,
    h: side,
  };
}

/**
 * A classic overlay mask that is drawn as a pattern (`preset.pattern`: { id, params }, see
 * masks/maskData.js), named after the preset.
 */
export function presetPatternLayer(doc, preset, { opacity = (preset.defaultAlpha ?? 75) / 100 } = {}) {
  return { ...patternLayer(doc, preset.pattern.id, { opacity, params: preset.pattern.params }), name: preset.name };
}

/** An overlay mask of emojis, tiled across the picture (raster/emoji.js draws it). */
export function emojiLayer(doc, emojis, { opacity = 0.9, params = null, deform = true, name = '' } = {}) {
  const side = Math.max(doc.width, doc.height);

  return {
    ...baseLayer('mask', name || emojiLayerName(emojis)),
    ...MASK_FX,
    ...(deform ? randomDeform() : {}),
    source: 'emoji',
    emojis: [...emojis],
    params: normalizeParams(EMOJI_MASK, params ?? defaultParams(EMOJI_MASK)),
    seed: Math.random() * 100,
    zoom: 50,
    natW: side,
    natH: side,
    opacity,
    x: doc.width / 2,
    y: doc.height / 2,
    w: side,
    h: side,
  };
}

/** [emoji, style] of every emoji drawn with artwork in the document (emoji masks and stamps). */
export function usedEmojis(doc) {
  const pairs = doc.layers.flatMap((layer) => [
    ...(layer.source === 'emoji' ? layer.emojis.map((emoji) => [emoji, layer.params?.style ?? 0]) : []),
    ...(layer.strokes ?? []).filter((stroke) => stroke.tool === 'stamp').map((stroke) => [stroke.emoji, stroke.style ?? 0]),
  ]);

  // The device's font needs nothing loaded, but server emojis always do.
  return pairs.filter(([emoji, style]) => style !== DEVICE_STYLE || isCustomEmoji(emoji));
}

export function emojiLayerName(emojis) {
  return `Emoji ${emojis.slice(0, 4).join('')}${emojis.length > 4 ? '…' : ''}`;
}

export function rectLayer(doc, { color = '#000000' } = {}) {
  return {
    ...baseLayer('rect', 'Rectangle'),
    color,
    corner: 0,
    x: doc.width / 2,
    y: doc.height / 2,
    w: Math.round(doc.width * 0.3),
    h: Math.round(doc.height * 0.2),
  };
}

export const SHAPE_NAMES = { ellipse: 'Circle', rect: 'Rectangle', triangle: 'Triangle', star: 'Star', heart: 'Heart' };

/**
 * A drawn shape (Shapes tool): `kind` ellipse | rect | triangle | star | heart, `fill` outline | fill,
 * `style` organic (hand-drawn) | clean, `width` the line width in document pixels, `seed` for the
 * hand-drawn look (raster/shapes.js).
 */
export function shapeLayer(doc, rect, { kind = 'ellipse', fill = 'outline', style = 'organic', color = '#e0262b', width = 8 } = {}) {
  return {
    ...baseLayer('shape', SHAPE_NAMES[kind] ?? 'Shape'),
    kind,
    fill,
    style,
    color,
    width,
    seed: Math.random(),
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    w: Math.max(1, rect.width),
    h: Math.max(1, rect.height),
  };
}

/**
 * An arrow from `tail` to `head` (document pixels). Its box is fitted around the curve; `points`
 * are the two ends inside the box (-0.5..0.5) and `bend` pushes the middle sideways.
 */
export function arrowLayer(doc, tail, head, { color = '#e0262b', width = 8, bend = 0.2, lean = 0, head: tip = 'open', bothEnds = false, style = 'organic' } = {}) {
  return placeArrow(
    { ...baseLayer('arrow', 'Arrow'), color, width, bend, lean, head: tip, bothEnds, style, seed: Math.random(), x: tail.x, y: tail.y, w: 1, h: 1, points: [0, 0, 0, 0] },
    tail,
    head
  );
}

/** The arrow's two ends in document pixels. */
export function arrowEndPoints(layer) {
  const matrix = layerMatrix(layer);
  const [ax, ay, bx, by] = layer.points;

  return [apply(matrix, ax, ay), apply(matrix, bx, by)];
}

/**
 * Puts the arrow's ends at `tail` and `head` (document pixels) and fits its box around the curve,
 * keeping its rotation. Also used after anything that changes how much room it needs (width, bend).
 */
export function placeArrow(layer, tail = arrowEndPoints(layer)[0], head = arrowEndPoints(layer)[1]) {
  const axes = layerAxes(layer);
  const back = invert(axes);
  const a = apply(back, tail.x - layer.x, tail.y - layer.y);
  const b = apply(back, head.x - layer.x, head.y - layer.y);
  const box = arrowBounds(layer, a, b);
  const w = Math.max(1, box.maxX - box.minX);
  const h = Math.max(1, box.maxY - box.minY);
  const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const shift = apply(axes, centre.x, centre.y);

  return {
    ...layer,
    x: layer.x + shift.x,
    y: layer.y + shift.y,
    w,
    h,
    points: [(a.x - centre.x) / w, (a.y - centre.y) / h, (b.x - centre.x) / w, (b.y - centre.y) / h],
  };
}

/** A saved shape or arrow made safe to draw, or null when it cannot be. */
export function normalizeMark(layer) {
  const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const pick = (value, values, fallback) => (values.includes(value) ? value : fallback);
  const next = {
    ...layer,
    color: typeof layer.color === 'string' && /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : '#e0262b',
    width: Math.max(0.5, finite(layer.width, 8)),
    style: pick(layer.style, ['organic', 'clean'], 'organic'),
    seed: finite(layer.seed, 0.5),
    w: Math.max(1, finite(layer.w, 100)),
    h: Math.max(1, finite(layer.h, 100)),
  };

  if (layer.type === 'shape') {
    return { ...next, kind: pick(layer.kind, Object.keys(SHAPE_NAMES), 'ellipse'), fill: pick(layer.fill, ['outline', 'fill'], 'outline') };
  }

  const points = Array.isArray(layer.points) && layer.points.length === 4 && layer.points.every((value) => Number.isFinite(Number(value)))
    ? layer.points.map(Number)
    : null;

  return points && {
    ...next,
    points,
    bend: Math.max(-1, Math.min(1, finite(layer.bend, 0))),
    lean: Math.max(-1, Math.min(1, finite(layer.lean, 0))),
    head: pick(layer.head, ['open', 'filled', 'none'], 'open'),
    bothEnds: layer.bothEnds === true,
  };
}

export function fitText(layer) {
  const size = measureText(layer);

  return { ...layer, w: size.width * (layer.sx || 1), h: size.height * (layer.sy || 1) };
}

export function textLayer(doc, style = {}) {
  return fitText({
    ...baseLayer('text', 'Text'),
    ...TEXT_DEFAULTS,
    size: Math.max(12, Math.round(Math.min(doc.width, doc.height) * 0.09)),
    ...style,
    sx: 1,
    sy: 1,
    x: doc.width / 2,
    y: doc.height / 2,
  });
}

export function drawingLayer(doc, name = 'Drawing') {
  return {
    ...baseLayer('drawing', name),
    strokes: [],
    x: doc.width / 2,
    y: doc.height / 2,
    w: doc.width,
    h: doc.height,
  };
}

export const CONTENT_DEFAULTS = { magnify: 1, rotation: 0, flipX: false, flipY: false };

/**
 * coverage: 'full' (whole canvas), 'rect' | 'ellipse' | 'polygon' (a movable region) or
 * 'paint' (brushed on). Polygon points are stored in the layer's local box (-0.5..0.5).
 */
export function effectLayer(doc, effectId, { coverage = 'full', rect = null, points = null, params = null } = {}) {
  const definition = getEffect(effectId);
  const box = rect ?? { x: 0, y: 0, width: doc.width, height: doc.height };

  return {
    ...baseLayer('effect', definition.name),
    effectId: definition.id,
    params: normalizeParams(definition, params ?? defaultParams(definition)),
    seed: Math.random() * 100,
    coverage,
    points: coverage === 'polygon' ? points : null,
    strokes: coverage === 'paint' ? [] : null,
    feather: 0,
    content: { ...CONTENT_DEFAULTS },
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    w: box.width,
    h: box.height,
  };
}

/** Layers that have a box the user can grab, resize and rotate on the canvas. */
export function isBoxLayer(layer) {
  if (layer.type === 'drawing') {
    return false;
  }

  if (layer.type === 'effect') {
    return layer.coverage === 'rect' || layer.coverage === 'ellipse' || layer.coverage === 'polygon';
  }

  return true;
}

/** Collage piece a layer is limited to: `layer.clip = { piece, points }`, flat document pixels. */
export function clipContains(layer, x, y) {
  const points = layer.clip?.points;

  return !(points?.length >= 6) || pointInPolygon(x, y, points);
}

export function hitLayer(layer, x, y) {
  if (!isBoxLayer(layer) || !clipContains(layer, x, y)) {
    return false;
  }

  if (layer.type === 'mask' && (layer.source === 'pattern' || layer.tile)) {
    return true;
  }

  const local = apply(invert(layerMatrix(layer)), x, y);

  if (Math.abs(local.x) > 0.5 || Math.abs(local.y) > 0.5) {
    return false;
  }

  if (layer.type === 'effect' && layer.coverage === 'ellipse') {
    return Math.hypot(local.x, local.y) <= 0.5;
  }

  if (layer.type === 'effect' && layer.coverage === 'polygon' && layer.points?.length >= 6) {
    return pointInPolygon(local.x, local.y, layer.points);
  }

  if (layer.type === 'arrow') {
    // Only near the line itself, so the empty part of its box does not hide what is under it.
    const [a, b] = arrowEnds(layer);
    const length = Math.hypot(b.x - a.x, b.y - a.y);

    return distanceToArrow(layer, local.x * layer.w, local.y * layer.h) <= (layer.width || 1) * 0.75 + headLength(layer.width || 1, length) * 0.4 + length * 0.03;
  }

  return true;
}

export function topLayerAt(doc, x, y) {
  for (let index = doc.layers.length - 1; index >= 0; index -= 1) {
    const layer = doc.layers[index];

    if (layer.visible && !layer.locked && hitLayer(layer, x, y)) {
      return layer;
    }
  }

  return null;
}

export function findLayer(doc, id) {
  return doc.layers.find((layer) => layer.id === id) ?? null;
}

export function updateLayer(doc, id, patch) {
  let changed = false;
  const layers = doc.layers.map((layer) => {
    if (layer.id !== id) {
      return layer;
    }

    changed = true;
    return { ...layer, ...(typeof patch === 'function' ? patch(layer) : patch) };
  });

  return changed ? { ...doc, layers } : doc;
}

export function insertLayer(doc, layer, index = doc.layers.length) {
  const layers = [...doc.layers];

  layers.splice(Math.max(0, Math.min(index, layers.length)), 0, layer);
  return { ...doc, layers };
}

/** Adds a mask on top of the stack, but below "revealed original" layers so they keep showing through. */
export function insertMask(doc, layer) {
  let index = doc.layers.length;

  while (index > 0 && doc.layers[index - 1].type === 'effect' && doc.layers[index - 1].effectId === 'original') {
    index -= 1;
  }

  return insertLayer(doc, layer, layer.effectId === 'original' ? doc.layers.length : index);
}

export function removeLayers(doc, ids) {
  const set = new Set(ids);

  return { ...doc, layers: doc.layers.filter((layer) => !set.has(layer.id)) };
}

export function moveLayer(doc, id, toIndex) {
  const from = doc.layers.findIndex((layer) => layer.id === id);

  if (from === -1) {
    return doc;
  }

  const layers = [...doc.layers];
  const [layer] = layers.splice(from, 1);

  layers.splice(Math.max(0, Math.min(toIndex, layers.length)), 0, layer);
  return { ...doc, layers };
}

export function cloneLayer(layer, offset = 0) {
  return {
    ...layer,
    id: uid(),
    name: /copy$/i.test(layer.name) ? layer.name : `${layer.name} copy`,
    base: false,
    locked: false,
    x: layer.x + offset,
    y: layer.y + offset,
  };
}

function shiftStrokes(strokes, dx, dy) {
  return strokes?.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((value, index) => value - (index % 2 === 0 ? dx : dy)),
  }));
}

function shiftClip(layer, rect) {
  const shift = (points) => points.map((value, index) => value - (index % 2 === 0 ? rect.x : rect.y));
  const patch = {};

  if (layer.clip?.points) {
    patch.clip = { ...layer.clip, points: shift(layer.clip.points) };
  }

  if (layer.erased?.length) {
    patch.erased = shiftStrokes(layer.erased, rect.x, rect.y);
  }

  if (Array.isArray(layer.cells)) {
    patch.cells = layer.cells.map((cell) => ({ ...cell, points: shift(cell.points) }));
  }

  return patch;
}

/** Crops or extends the canvas to `rect` (document pixels), keeping every layer in place. */
export function resizeCanvas(doc, rect) {
  const next = createDoc(rect.width, rect.height);

  next.layers = doc.layers.map((layer) => {
    if (layer.type === 'drawing' || (layer.type === 'effect' && (layer.coverage === 'full' || layer.coverage === 'paint'))) {
      return {
        ...layer,
        strokes: shiftStrokes(layer.strokes, rect.x, rect.y) ?? layer.strokes,
        x: next.width / 2,
        y: next.height / 2,
        w: next.width,
        h: next.height,
        ...shiftClip(layer, rect),
      };
    }

    return { ...layer, x: layer.x - rect.x, y: layer.y - rect.y, ...shiftClip(layer, rect) };
  });

  return next;
}

export function selectionBounds(doc, ids) {
  const boxes = ids
    .map((id) => findLayer(doc, id))
    .filter((layer) => layer && isBoxLayer(layer))
    .map((layer) => layerBounds(layer));

  if (!boxes.length) {
    return null;
  }

  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function describeLayer(layer) {
  switch (layer.type) {
    case 'image':
      return layer.base ? 'Base image' : 'Image';
    case 'mask':
      return layer.source === 'pattern' ? 'Pattern mask' : 'Overlay mask';
    case 'effect':
      return layer.coverage === 'full' ? 'Effect mask' : layer.coverage === 'paint' ? 'Painted effect' : 'Effect region';
    case 'drawing':
      return 'Drawing';
    case 'text':
      return 'Text';
    case 'rect':
      return 'Rectangle';
    case 'shape':
      return SHAPE_NAMES[layer.kind] ?? 'Shape';
    case 'arrow':
      return 'Arrow';
    default:
      return 'Layer';
  }
}

/**
 * Swaps the base picture for `asset` and carries the other layers over to the new canvas size:
 * full-canvas masks are re-fitted, positioned layers are scaled along. Drawings and painted
 * areas belong to the old picture and are dropped.
 */
export function rebaseDoc(doc, asset) {
  const next = createDoc(asset.width, asset.height);
  const scaleX = next.width / doc.width;
  const scaleY = next.height / doc.height;
  const scale = Math.min(scaleX, scaleY);
  const centre = { x: next.width / 2, y: next.height / 2 };

  next.layers = [imageLayer(next, asset, { name: 'Base image', base: true })];

  for (const source of doc.layers) {
    if (source.type === 'drawing' || (source.type === 'image' && source.base) || (source.type === 'effect' && source.coverage === 'paint')) {
      continue;
    }

    // Erased areas were painted over the old picture.
    const layer = source.erased ? { ...source, erased: null } : source;

    if (layer.type === 'effect' && layer.coverage === 'full') {
      next.layers.push({ ...layer, ...centre, w: next.width, h: next.height });
    } else if (layer.type === 'mask') {
      const fit = layer.source === 'pattern' || layer.source === 'emoji'
        ? Math.max(next.width, next.height) / layer.natW
        : Math.max(next.width / layer.natW, next.height / layer.natH);
      const natW = layer.natW * fit;
      const natH = layer.natH * fit;

      next.layers.push({ ...layer, ...centre, natW, natH, w: natW * zoomFactor(layer.zoom ?? 50), h: natH * zoomFactor(layer.zoom ?? 50) });
    } else if (layer.type === 'text') {
      next.layers.push(fitText({ ...layer, x: layer.x * scaleX, y: layer.y * scaleY, size: Math.max(4, layer.size * scale) }));
    } else {
      next.layers.push({
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        w: layer.w * scale,
        h: layer.h * scale,
        corner: layer.corner ? layer.corner * scale : layer.corner,
        ...(layer.type === 'shape' || layer.type === 'arrow' ? { width: (layer.width || 1) * scale } : {}),
      });
    }
  }

  return next;
}
