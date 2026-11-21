import { normalizeRegionEffectData } from '../tools/regionDefinitions.js';

export const SCENE_DOCUMENT_VERSION = 6;

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBackground(background) {
  if (!background || typeof background !== 'object') {
    return null;
  }

  const type = background.type === 'external' ? 'external' : 'local';
  const url = typeof background.url === 'string' ? background.url : '';
  const visible = background.visible !== false;
  const opacity = Number.isFinite(Number(background.opacity)) ? Number(background.opacity) : 1;
  const embeddedDataUrl = typeof background.embeddedDataUrl === 'string' ? background.embeddedDataUrl : '';

  return {
    type,
    url,
    visible,
    opacity,
    embeddedDataUrl,
  };
}

function normalizeViewport(viewport) {
  const scale = Number(viewport?.scale);
  const x = Number(viewport?.x);
  const y = Number(viewport?.y);

  return {
    scale: Number.isFinite(scale) ? scale : 1,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function normalizeDocumentSize(documentSize) {
  const width = Number(documentSize?.width);
  const height = Number(documentSize?.height);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function normalizeUi(ui) {
  return {
    uploadedUrl: typeof ui?.uploadedUrl === 'string' ? ui.uploadedUrl : '',
    roundTitle: typeof ui?.roundTitle === 'string' ? ui.roundTitle : '',
    roundAnswer: typeof ui?.roundAnswer === 'string' ? ui.roundAnswer : '',
    subreddit: typeof ui?.subreddit === 'string' ? ui.subreddit : 'picturegame',
    exportPreset: typeof ui?.exportPreset === 'string' ? ui.exportPreset : 'original_png',
    exportSize: typeof ui?.exportSize === 'string' ? ui.exportSize : 'original',
    exportFormat: typeof ui?.exportFormat === 'string' ? ui.exportFormat : 'png',
    exportQuality: typeof ui?.exportQuality === 'string' ? ui.exportQuality : '92',
  };
}

function normalizeObjectState(object = {}) {
  return {
    x: Number.isFinite(Number(object.x)) ? Number(object.x) : 0,
    y: Number.isFinite(Number(object.y)) ? Number(object.y) : 0,
    scaleX: Number.isFinite(Number(object.scaleX)) ? Number(object.scaleX) : 1,
    scaleY: Number.isFinite(Number(object.scaleY)) ? Number(object.scaleY) : 1,
    rotation: Number.isFinite(Number(object.rotation)) ? Number(object.rotation) : 0,
    alpha: Number.isFinite(Number(object.alpha)) ? Number(object.alpha) : 1,
    blendMode: typeof object.blendMode === 'string' ? object.blendMode : 'normal',
    skewX: Number.isFinite(Number(object.skewX)) ? Number(object.skewX) : 0,
    skewY: Number.isFinite(Number(object.skewY)) ? Number(object.skewY) : 0,
    text: typeof object.text === 'string' ? object.text : '',
    maskMeta: cloneJson(object.maskMeta ?? {}),
    effects: Array.isArray(object.effects) ? cloneJson(object.effects) : [],
    shapeData: cloneJson(object.shapeData ?? {}),
    imageLayerData: cloneJson(object.imageLayerData ?? {}),
    regionEffectData: object.regionEffectData
      ? normalizeRegionEffectData(object.regionEffectData)
      : {},
    textData: cloneJson(object.textData ?? {}),
  };
}

function normalizeLayer(layer) {
  if (!layer || typeof layer !== 'object' || typeof layer.type !== 'string') {
    return null;
  }

  return {
    name: typeof layer.name === 'string' ? layer.name : 'Layer',
    type: layer.type,
    visible: layer.visible !== false,
    opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
    locked: layer.locked === true,
    layerState: normalizeObjectState(layer.layerState ?? {}),
    paintEffect: cloneJson(layer.paintEffect ?? {}),
    object: normalizeObjectState(layer.object ?? {}),
    strokes: Array.isArray(layer.strokes) ? cloneJson(layer.strokes) : [],
  };
}

export function normalizeSceneDocument(document) {
  if (!document || typeof document !== 'object') {
    return null;
  }

  const background = normalizeBackground(document.background);

  if (!background) {
    return null;
  }

  const normalized = {
    version: SCENE_DOCUMENT_VERSION,
    savedAt: typeof document.savedAt === 'string' ? document.savedAt : new Date().toISOString(),
    background,
    canRestore: (background.type === 'external' && Boolean(background.url)) ||
      Boolean(background.embeddedDataUrl) ||
      /^data:/i.test(background.url),
    documentSize: normalizeDocumentSize(document.documentSize),
    viewport: normalizeViewport(document.viewport),
    drawing: {
      strokes: Array.isArray(document.drawing?.strokes) ? cloneJson(document.drawing.strokes) : [],
      layerState: normalizeObjectState(document.drawing?.layerState ?? {}),
    },
    layers: Array.isArray(document.layers)
      ? document.layers.map((layer) => normalizeLayer(layer)).filter(Boolean)
      : [],
    ui: normalizeUi(document.ui),
  };

  return normalized;
}

export function createSceneDocument(partial) {
  return normalizeSceneDocument({
    ...partial,
    version: SCENE_DOCUMENT_VERSION,
    savedAt: partial?.savedAt ?? new Date().toISOString(),
  });
}
