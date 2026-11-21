// Freehand tools. One class covers three modes:
//   brush  - paints into a drawing layer
//   eraser - erases from a drawing layer or from a painted effect's coverage
//   paint  - brushes an effect (blur, pixelate, cut glass, ...) onto the picture

import { drawingLayer, effectLayer, insertLayer, updateLayer } from '../core/model.js';

export class BrushTool {
  constructor(app, mode) {
    this.app = app;
    this.mode = mode;
    this.cursor = 'crosshair';
    this.stroke = null;
    this.layerId = null;
    this.ring = document.createElement('div');
    this.ring.className = 'brush-ring hidden';
    app.stage.html.append(this.ring);
    app.bus.on('view', () => this.resizeRing());
    app.bus.on('tool-settings', () => this.resizeRing());
  }

  activate() {
    this.resizeRing();
  }

  deactivate() {
    this.ring.classList.add('hidden');
    this.onCancel();
  }

  /** Brush diameter in document pixels. The slider is relative to the picture, not to the screen. */
  size() {
    const doc = this.app.store.doc;
    return Math.max(1, (this.app.toolState.brush.size * Math.min(doc.width, doc.height)) / 900);
  }

  resizeRing() {
    const diameter = Math.max(4, this.size() * this.app.stage.view.zoom);

    this.ring.style.width = `${diameter}px`;
    this.ring.style.height = `${diameter}px`;
  }

  moveRing(event) {
    this.ring.classList.remove('hidden');
    this.ring.style.transform = `translate(${event.sx}px, ${event.sy}px) translate(-50%, -50%)`;
  }

  onHover(event) {
    this.moveRing(event);
  }

  onLeave() {
    if (!this.stroke) {
      this.ring.classList.add('hidden');
    }
  }

  /** Finds the layer this stroke goes into, or describes the one that has to be created. */
  resolveTarget() {
    const { store } = this.app;
    const doc = store.doc;
    const selected = store.selectedLayer;
    const usable = (layer) => layer && layer.visible && !layer.locked;

    if (this.mode === 'paint') {
      if (usable(selected) && selected.type === 'effect' && selected.coverage === 'paint') {
        return { layer: selected };
      }

      return { create: effectLayer(doc, this.app.toolState.paint.effectId, { coverage: 'paint' }) };
    }

    if (this.mode === 'eraser') {
      if (usable(selected) && (selected.type === 'drawing' || (selected.type === 'effect' && selected.coverage === 'paint'))) {
        return { layer: selected };
      }

      const drawing = [...doc.layers].reverse().find((layer) => usable(layer) && layer.type === 'drawing' && layer.strokes.length);

      return drawing ? { layer: drawing } : null;
    }

    if (usable(selected) && selected.type === 'drawing') {
      return { layer: selected };
    }

    const top = doc.layers[doc.layers.length - 1];

    if (usable(top) && top.type === 'drawing') {
      return { layer: top };
    }

    const count = doc.layers.filter((layer) => layer.type === 'drawing').length;

    return { create: drawingLayer(doc, count ? `Drawing ${count + 1}` : 'Drawing') };
  }

  onDown(event) {
    const { store, toolState } = this.app;
    const target = this.resolveTarget();

    this.moveRing(event);

    if (!target) {
      this.app.notify('There is nothing to erase yet.', 'info');
      return;
    }

    const brush = toolState.brush;

    this.stroke = {
      tool: this.mode === 'eraser' ? 'eraser' : 'brush',
      type: this.mode === 'brush' ? brush.type : 'smooth',
      color: this.mode === 'paint' ? '#ffffff' : brush.color,
      size: this.size(),
      opacity: this.mode === 'eraser' ? 1 : brush.opacity / 100,
      seed: Math.random(),
      points: [event.x, event.y],
    };
    this.created = Boolean(target.create);
    this.layerId = (target.layer ?? target.create).id;

    store.begin();

    if (target.create) {
      store.set(insertLayer(store.doc, target.create));
    }

    store.set(updateLayer(store.doc, this.layerId, (layer) => ({ strokes: [...layer.strokes, this.stroke] })));
  }

  onMove(event) {
    this.moveRing(event);

    if (!this.stroke) {
      return;
    }

    const points = this.stroke.points;
    const minimum = 0.75 / this.app.stage.view.zoom;

    if (Math.hypot(event.x - points[points.length - 2], event.y - points[points.length - 1]) < minimum) {
      return;
    }

    // The point list is extended in place; a fresh stroke object tells the rasteriser to redraw it.
    points.push(event.x, event.y);
    this.stroke = { ...this.stroke };

    const stroke = this.stroke;

    this.app.store.set(
      updateLayer(this.app.store.doc, this.layerId, (layer) => ({ strokes: [...layer.strokes.slice(0, -1), stroke] }))
    );
  }

  onUp() {
    if (!this.stroke) {
      return;
    }

    const { store } = this.app;

    this.stroke = null;
    store.end(this.mode === 'eraser' ? 'Erase' : this.mode === 'paint' ? 'Paint effect' : 'Brush stroke');

    if (this.created && this.mode === 'paint') {
      store.select([this.layerId]);
    }
  }

  onCancel() {
    if (this.stroke) {
      this.stroke = null;
      this.app.store.cancel();
    }
  }
}
