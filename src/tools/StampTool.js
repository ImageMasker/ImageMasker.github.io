// Stamp tool: puts an emoji on the picture where you click, at the size set in its options.
// Dragging either lays a trail of stamps (like a brush) or, in "size" mode, sizes and turns the one
// stamp from where the drag started. Stamps are strokes of a drawing layer (raster/strokes.js), so
// they undo, erase and save like brush strokes.

import { drawingLayer, insertLayer, updateLayer } from '../core/model.js';
import { emojiGlyph, emojiImage } from '../raster/emojiArt.js';

export const STAMP_DRAG_MODES = [
  { value: 'trail', label: 'Lays a trail' },
  { value: 'size', label: 'Sizes the stamp' },
];

export class StampTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'crosshair';
    this.stroke = null;
    this.layerId = null;
    this.ghost = document.createElement('div');
    this.ghost.className = 'stamp-ghost hidden';
    this.ghostKey = '';
    app.stage.html.append(this.ghost);
    app.bus.on('view', () => this.syncGhost());
    app.bus.on('tool-settings', () => this.syncGhost());
  }

  get options() {
    return this.app.toolState.stamp;
  }

  activate() {
    this.syncGhost();
  }

  deactivate() {
    this.ghost.classList.add('hidden');
    this.onCancel();
  }

  /** Stamp size in document pixels; like the brush, relative to the picture. */
  size() {
    const doc = this.app.store.doc;

    return Math.max(2, (this.options.size * Math.min(doc.width, doc.height)) / 400);
  }

  syncGhost() {
    const { emoji, style, opacity, angle } = this.options;
    const side = Math.max(6, this.size() * this.app.stage.view.zoom);

    // Starts loading the artwork the stamp will be drawn with.
    emojiImage(emoji, style);

    if (this.ghostKey !== `${style}:${emoji}`) {
      this.ghostKey = `${style}:${emoji}`;
      this.ghost.replaceChildren(emojiGlyph(emoji, style));
    }

    this.ghost.style.width = `${side}px`;
    this.ghost.style.height = `${side}px`;
    this.ghost.style.fontSize = `${side * 0.86}px`;
    this.ghost.style.opacity = String(0.35 + 0.4 * (opacity / 100));
    this.ghost.style.setProperty('--stamp-angle', `${angle}deg`);
  }

  moveGhost(event) {
    if (this.stroke && this.options.drag === 'size') {
      return;
    }

    this.ghost.classList.remove('hidden');
    this.ghost.style.left = `${event.sx}px`;
    this.ghost.style.top = `${event.sy}px`;
  }

  onHover(event) {
    this.moveGhost(event);
  }

  onLeave() {
    if (!this.stroke) {
      this.ghost.classList.add('hidden');
    }
  }

  /** The selected or topmost drawing layer, or a new "Stamps" layer. */
  resolveTarget() {
    const { store } = this.app;
    const doc = store.doc;
    const usable = (layer) => layer && layer.visible && !layer.locked && layer.type === 'drawing';
    const selected = store.selectedLayer;
    const top = doc.layers[doc.layers.length - 1];

    if (usable(selected)) return { layer: selected };
    if (usable(top)) return { layer: top };

    return { create: drawingLayer(doc, 'Stamps') };
  }

  onDown(event) {
    const { store } = this.app;
    const options = this.options;
    const target = this.resolveTarget();

    this.moveGhost(event);
    this.start = { x: event.x, y: event.y };
    this.stroke = {
      tool: 'stamp',
      emoji: options.emoji,
      style: options.style,
      size: this.size(),
      opacity: options.opacity / 100,
      angle: options.angle,
      spin: options.spin,
      seed: Math.random(),
      points: [event.x, event.y],
    };
    this.layerId = (target.layer ?? target.create).id;
    this.rememberEmoji(options.emoji);

    store.begin();

    if (target.create) {
      store.set(insertLayer(store.doc, target.create));
    }

    store.set(updateLayer(store.doc, this.layerId, (layer) => ({ strokes: [...layer.strokes, this.stroke] })));
  }

  onMove(event) {
    this.moveGhost(event);

    if (!this.stroke) {
      return;
    }

    if (this.options.drag === 'size') {
      const dx = event.x - this.start.x;
      const dy = event.y - this.start.y;
      const distance = Math.hypot(dx, dy);

      // Tiny drags are just clicks: keep the size from the options.
      if (distance * this.app.stage.view.zoom < 6) {
        return;
      }

      this.stroke = { ...this.stroke, size: distance * 2, angle: (Math.atan2(dy, dx) * 180) / Math.PI - 90 };
    } else {
      const points = this.stroke.points;

      if (Math.hypot(event.x - points[points.length - 2], event.y - points[points.length - 1]) < this.stroke.size * 0.25) {
        return;
      }

      this.stroke = { ...this.stroke, points: [...points, event.x, event.y] };
    }

    const stroke = this.stroke;

    this.app.store.set(updateLayer(this.app.store.doc, this.layerId, (layer) => ({ strokes: [...layer.strokes.slice(0, -1), stroke] })));
  }

  onUp() {
    if (!this.stroke) {
      return;
    }

    this.stroke = null;
    this.app.store.end('Stamp');
  }

  onCancel() {
    if (this.stroke) {
      this.stroke = null;
      this.app.store.cancel();
    }
  }

  /** Keeps the last few stamped emojis one click away in the tool options. */
  rememberEmoji(emoji) {
    const options = this.options;

    options.recent = [emoji, ...options.recent.filter((entry) => entry !== emoji)].slice(0, 12);
    this.app.bus.emit('tool-settings');
  }
}
