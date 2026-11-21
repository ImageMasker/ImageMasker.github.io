// Text layout and rasterisation with Canvas 2D.

export const FONTS = [
  'Arial Black',
  'Impact',
  'Georgia',
  'Courier New',
  'Arial',
  'Verdana',
  'Times New Roman',
  'Trebuchet MS',
  'Comic Sans MS',
];

export const TEXT_DEFAULTS = {
  text: 'Text',
  font: 'Arial Black',
  size: 50,
  color: '#ffffff',
  align: 'center',
  bold: true,
  italic: false,
  outlineColor: '#000000',
  outlineWidth: 6,
  shadow: false,
  shadowColor: '#000000',
  shadowBlur: 8,
  shadowDistance: 12,
};

export const TEXT_STYLE_KEYS = Object.keys(TEXT_DEFAULTS);

const LINE_HEIGHT = 1.2;
let measureContext = null;

function fontString(style, size) {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px "${style.font}", sans-serif`;
}

function getLines(style) {
  return String(style.text ?? '').split('\n');
}

/** Natural (unscaled) size of a text block in document pixels, including outline/shadow padding. */
export function measureText(style) {
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d');
  }

  const size = Math.max(1, Number(style.size) || 1);
  const lines = getLines(style);

  measureContext.font = fontString(style, size);

  const textWidth = Math.max(size * 0.25, ...lines.map((line) => measureContext.measureText(line).width));
  const outline = (size * (Number(style.outlineWidth) || 0)) / 100;
  const shadow = style.shadow
    ? (size * ((Number(style.shadowBlur) || 0) * 1.5 + (Number(style.shadowDistance) || 0))) / 100
    : 0;
  const pad = Math.ceil(outline + shadow + size * 0.12);

  return {
    width: Math.ceil(textWidth + pad * 2),
    height: Math.ceil(lines.length * size * LINE_HEIGHT + pad * 2),
    pad,
    lines,
  };
}

/** Draws the text block into a new canvas at `pixelRatio` canvas pixels per document pixel. */
export function renderText(style, pixelRatio) {
  const layout = measureText(style);
  const size = Math.max(1, Number(style.size) || 1);
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.ceil(layout.width * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(layout.height * pixelRatio));

  const ctx = canvas.getContext('2d');
  const outline = (size * (Number(style.outlineWidth) || 0)) / 100;
  const x = style.align === 'left' ? layout.pad : style.align === 'right' ? layout.width - layout.pad : layout.width / 2;

  ctx.scale(pixelRatio, pixelRatio);
  ctx.font = fontString(style, size);
  ctx.textAlign = style.align === 'left' || style.align === 'right' ? style.align : 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const applyShadow = () => {
    const distance = (size * (Number(style.shadowDistance) || 0)) / 100;

    // Shadow settings ignore the canvas transform, so scale them by hand.
    ctx.shadowColor = style.shadowColor || '#000000';
    ctx.shadowBlur = ((size * (Number(style.shadowBlur) || 0)) / 100) * pixelRatio;
    ctx.shadowOffsetX = distance * 0.7071 * pixelRatio;
    ctx.shadowOffsetY = distance * 0.7071 * pixelRatio;
  };
  const clearShadow = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  layout.lines.forEach((line, index) => {
    const y = layout.pad + size * LINE_HEIGHT * (index + 0.5);

    if (outline > 0) {
      if (style.shadow) {
        applyShadow();
      }

      ctx.strokeStyle = style.outlineColor || '#000000';
      ctx.lineWidth = outline * 2;
      ctx.strokeText(line, x, y);
      clearShadow();
    } else if (style.shadow) {
      applyShadow();
    }

    ctx.fillStyle = style.color || '#000000';
    ctx.fillText(line, x, y);
    clearShadow();
  });

  return canvas;
}

export function textSignature(style) {
  return TEXT_STYLE_KEYS.map((key) => style[key]).join('\u0001');
}
