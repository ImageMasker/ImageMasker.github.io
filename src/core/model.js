// The document is plain immutable data: { width, height, layers: [bottom ... top] }.
// Every edit produces a new document object that shares the untouched layers, which makes
// undo/redo a matter of keeping references.

import { defaultParams, getEffect, normalizeParams } from '../gl/effects.js';
import { getPattern } from '../gl/patterns.js';
import { measureText, TEXT_DEFAULTS } from '../raster/text.js';
import { apply, invert, layerBounds, layerMatrix, pointInPolygon } from './geometry.js';

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

export function maskLayer(doc, asset, { name = 'Mask', opacity = 0.75, zoom = 55, deform = true, tile = false } = {}) {
  const fit = Math.max(doc.width / asset.width, doc.height / asset.height);
  const factor = fit * zoomFactor(zoom);

  return {
    ...baseLayer('mask', name),
    ...MASK_FX,
    ...(deform ? randomDeform() : {}),
    source: 'asset',
    assetId: asset.id,
    tile,
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

export function hitLayer(layer, x, y) {
  if (!isBoxLayer(layer)) {
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
      };
    }

    return { ...layer, x: layer.x - rect.x, y: layer.y - rect.y };
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

  for (const layer of doc.layers) {
    if (layer.type === 'drawing' || (layer.type === 'image' && layer.base) || (layer.type === 'effect' && layer.coverage === 'paint')) {
      continue;
    }

    if (layer.type === 'effect' && layer.coverage === 'full') {
      next.layers.push({ ...layer, ...centre, w: next.width, h: next.height });
    } else if (layer.type === 'mask') {
      const fit = layer.source === 'pattern'
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
      });
    }
  }

  return next;
}
