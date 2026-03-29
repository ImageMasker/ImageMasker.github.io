export const REGION_SHAPE_OPTIONS = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'freehand', label: 'Freehand' },
];

export const REGION_EFFECT_DEFINITIONS = {
  none: {
    label: 'None',
    defaultAmount: 0,
    defaultRadius: 120,
    showAmount: false,
    showRadius: false,
    showReseed: false,
  },
  blur: {
    label: 'Blur',
    defaultAmount: 12,
    defaultRadius: 120,
    showAmount: true,
    showRadius: false,
    showReseed: false,
  },
  pixelate: {
    label: 'Pixelate',
    defaultAmount: 14,
    defaultRadius: 120,
    showAmount: true,
    showRadius: false,
    showReseed: false,
  },
  twist: {
    label: 'Swirl',
    defaultAmount: 32,
    defaultRadius: 120,
    showAmount: true,
    showRadius: true,
    showReseed: false,
  },
  bulgePinch: {
    label: 'Fisheye',
    defaultAmount: 40,
    defaultRadius: 120,
    showAmount: true,
    showRadius: true,
    showReseed: false,
  },
  zoomBlur: {
    label: 'Zoom blur',
    defaultAmount: 20,
    defaultRadius: 140,
    showAmount: true,
    showRadius: true,
    showReseed: false,
  },
  radialBlur: {
    label: 'Radial blur',
    defaultAmount: 18,
    defaultRadius: 140,
    showAmount: true,
    showRadius: true,
    showReseed: false,
  },
  rgbSplit: {
    label: 'RGB split',
    defaultAmount: 8,
    defaultRadius: 120,
    showAmount: true,
    showRadius: false,
    showReseed: false,
  },
  noise: {
    label: 'Noise',
    defaultAmount: 18,
    defaultRadius: 120,
    showAmount: true,
    showRadius: false,
    showReseed: true,
  },
  displacement: {
    label: 'Warp',
    defaultAmount: 18,
    defaultRadius: 120,
    showAmount: true,
    showRadius: false,
    showReseed: true,
  },
};

export const REGION_EFFECT_OPTIONS = Object.entries(REGION_EFFECT_DEFINITIONS).map(
  ([value, definition]) => ({
    value,
    label: definition.label,
  })
);

export function getRegionEffectDefinition(type) {
  return REGION_EFFECT_DEFINITIONS[type] ?? REGION_EFFECT_DEFINITIONS.blur;
}

export function createDefaultRegionEffect(type = 'blur', partial = {}) {
  const definition = getRegionEffectDefinition(type);

  return {
    type,
    amount: Number.isFinite(Number(partial.amount))
      ? Number(partial.amount)
      : definition.defaultAmount,
    radius: Number.isFinite(Number(partial.radius))
      ? Number(partial.radius)
      : definition.defaultRadius,
    seed: Number.isFinite(Number(partial.seed))
      ? Number(partial.seed)
      : Math.random(),
  };
}

export function createDefaultRegionData(partial = {}) {
  const shapeType = typeof partial?.shape?.type === 'string'
    ? partial.shape.type
    : 'rect';
  const effectType = typeof partial?.effect?.type === 'string'
    ? partial.effect.type
    : 'blur';

  return normalizeRegionEffectData({
    shape: {
      type: shapeType,
      width: 220,
      height: 160,
      radius: 110,
      points: [],
      ...(partial.shape ?? {}),
    },
    content: {
      magnify: 1,
      rotation: 0,
      reflectX: false,
      reflectY: false,
      ...(partial.content ?? {}),
    },
    effect: createDefaultRegionEffect(effectType, partial.effect ?? {}),
    blendMode: partial.blendMode ?? 'normal',
  });
}

export function cloneRegionEffectData(data) {
  return JSON.parse(JSON.stringify(normalizeRegionEffectData(data)));
}

export function normalizeRegionEffectData(data = {}) {
  if (data?.effectType) {
    return migrateLegacyRegionEffectData(data);
  }

  const shape = normalizeShapeData(data.shape ?? {});
  const content = normalizeContentData(data.content ?? {});
  const effect = normalizeEffectData(data.effect ?? {});

  return {
    shape,
    content,
    effect,
    blendMode: typeof data.blendMode === 'string' ? data.blendMode : 'normal',
  };
}

export function migrateLegacyRegionEffectData(data = {}) {
  const effectType = data.effectType === 'pixelate' ? 'pixelate' : 'blur';

  return createDefaultRegionData({
    shape: {
      type: 'rect',
      width: Number.isFinite(Number(data.width)) ? Number(data.width) : 220,
      height: Number.isFinite(Number(data.height)) ? Number(data.height) : 160,
    },
    effect: {
      type: effectType,
      amount: Number.isFinite(Number(data.intensity)) ? Number(data.intensity) : 12,
    },
    blendMode: typeof data.blendMode === 'string' ? data.blendMode : 'normal',
  });
}

export function getRegionPreviewBadge(type = 'blur') {
  const badges = {
    none: 'REG',
    blur: 'BLR',
    pixelate: 'PXL',
    twist: 'SWR',
    bulgePinch: 'FSH',
    zoomBlur: 'ZBL',
    radialBlur: 'RBL',
    rgbSplit: 'RGB',
    noise: 'NOS',
    displacement: 'WRP',
  };

  return badges[type] ?? 'REG';
}

function normalizeShapeData(shape = {}) {
  const type = ['rect', 'circle', 'freehand'].includes(shape.type) ? shape.type : 'rect';

  if (type === 'circle') {
    return {
      type,
      radius: Math.max(8, Number.isFinite(Number(shape.radius)) ? Number(shape.radius) : 80),
    };
  }

  if (type === 'freehand') {
    const points = Array.isArray(shape.points)
      ? shape.points
          .map((point) => ({
            x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 0,
            y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 0,
          }))
          .filter((point, index, source) => {
            if (index === 0) {
              return true;
            }

            const previous = source[index - 1];
            return previous.x !== point.x || previous.y !== point.y;
          })
      : [];

    if (points.length < 3) {
      return {
        type: 'rect',
        width: 220,
        height: 160,
      };
    }

    return {
      type,
      points,
    };
  }

  return {
    type: 'rect',
    width: Math.max(8, Number.isFinite(Number(shape.width)) ? Number(shape.width) : 220),
    height: Math.max(8, Number.isFinite(Number(shape.height)) ? Number(shape.height) : 160),
  };
}

function normalizeContentData(content = {}) {
  const magnify = Number(content.magnify);
  const rotation = Number(content.rotation);

  return {
    magnify: Number.isFinite(magnify) ? clamp(magnify, 0.25, 4) : 1,
    rotation: Number.isFinite(rotation) ? rotation : 0,
    reflectX: content.reflectX === true,
    reflectY: content.reflectY === true,
  };
}

function normalizeEffectData(effect = {}) {
  const type = typeof effect.type === 'string' && REGION_EFFECT_DEFINITIONS[effect.type]
    ? effect.type
    : 'blur';

  return createDefaultRegionEffect(type, effect);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
