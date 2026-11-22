// Freehand tools. One class covers three modes:
//   brush  - paints into a drawing layer
//   eraser - erases from a drawing layer or from a painted effect's coverage, or erases any kind
//            of selected layer (its `erased` strokes); it can also "reveal" the original
//            picture through every mask, or restore what was revealed
//   paint  - brushes an effect (blur, pixelate, cut glass, ...) onto the picture

import { drawingLayer, effectLayer, insertLayer, insertMask, updateLayer } from '../core/model.js';
import { defaultParams, getEffect } from '../gl/effects.js';

/** The one slider the blur / pixel brushes expose, per effect. */
export const PAINT_AMOUNT = {
  blur: { key: 'amount', label: 'Blur amount', min: 1, max: 100, step: 1 },
  pixelate: { key: 'size', label: 'Pixel size', min: 0.2, max: 12, step: 0.1 },
};

export class BrushTool {
  constructor(app, mode, { effectId = null } = {}) {
    this.app = app;
    this.mode = mode;
    this.effectId = effectId;
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

    const painted = (effectId) => (layer) =>
      usable(layer) && layer.type === 'effect' && layer.coverage === 'paint' && layer.effectId === effectId;
    const topmost = (test) => [...doc.layers].reverse().find(test);

    if (this.mode === 'paint') {
      const effectId = this.paintEffectId();
      const existing = painted(effectId)(selected) ? selected : topmost(painted(effectId));

      if (existing) {
        return { layer: existing };
      }

      const amount = PAINT_AMOUNT[effectId];
      const params = amount
        ? { ...defaultParams(getEffect(effectId)), [amount.key]: this.app.toolState.paint.amounts[effectId] }
        : null;

      return { create: effectLayer(doc, effectId, { coverage: 'paint', params }) };
    }

    const eraserMode = this.mode === 'eraser' ? this.app.toolState.eraser.mode : '';

    // Any layer can be erased; its `erased` strokes take it back out where they cover it.
    if (eraserMode === 'layer') {
      return usable(selected) ? { layer: selected, field: 'erased' } : null;
    }

    if (eraserMode === 'reveal' || eraserMode === 'restore') {
      const existing = topmost(painted('original'));

      if (existing || eraserMode === 'restore') {
        return existing ? { layer: existing } : null;
      }

      return { create: { ...effectLayer(doc, 'original', { coverage: 'paint' }), name: 'Revealed original' } };
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

  missingTargetMessage() {
    const mode = this.mode === 'eraser' ? this.app.toolState.eraser.mode : '';
    const selected = this.app.store.selectedLayer;

    if (mode === 'restore') {
      return 'Nothing has been revealed yet.';
    }

    if (mode === 'layer') {
      if (!selected) {
        return 'Select the layer to erase first (click it in the Layers list).';
      }

      return selected.locked ? `“${selected.name}” is locked. Unlock it in the Layers list to erase it.` : `“${selected.name}” is hidden.`;
    }

    return 'There is nothing to erase yet.';
  }

  paintEffectId() {
    return this.effectId ?? this.app.toolState.paint.effectId;
  }

  /** The painted layer the next stroke would go into, if it already exists. */
  existingTarget() {
    return this.resolveTarget()?.layer ?? null;
  }

  onDown(event) {
    const { store, toolState } = this.app;
    const target = this.resolveTarget();
    const reveal = this.mode === 'eraser' && toolState.eraser.mode === 'reveal';

    this.moveRing(event);

    if (!target) {
      this.app.notify(this.missingTargetMessage(), 'info', 3600);
      return;
    }

    const brush = toolState.brush;
    const layerErase = target.field === 'erased';
    const erasing = this.mode === 'eraser' && !reveal && !layerErase;

    this.stroke = {
      tool: erasing ? 'eraser' : 'brush',
      type: this.mode === 'brush' ? brush.type : 'smooth',
      color: this.mode === 'brush' ? brush.color : '#ffffff',
      size: this.size(),
      // The erased area is painted like a brush stroke (more coverage = more erased), at the eraser's strength.
      opacity: erasing ? 1 : brush.opacity / 100,
      seed: Math.random(),
      points: [event.x, event.y],
    };
    this.created = Boolean(target.create);
    this.layerId = (target.layer ?? target.create).id;
    this.field = target.field ?? 'strokes';

    store.begin();

    if (target.create) {
      store.set(target.create.type === 'effect' ? insertMask(store.doc, target.create) : insertLayer(store.doc, target.create));
    }

    store.set(updateLayer(store.doc, this.layerId, (layer) => ({ [this.field]: [...(layer[this.field] ?? []), this.stroke] })));
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
      updateLayer(this.app.store.doc, this.layerId, (layer) => ({ [this.field]: [...layer[this.field].slice(0, -1), stroke] }))
    );
  }

  onUp() {
    if (!this.stroke) {
      return;
    }

    const { store } = this.app;

    this.stroke = null;
    const eraserMode = this.app.toolState.eraser.mode;
    const label =
      this.mode === 'paint'
        ? 'Paint effect'
        : this.mode === 'brush'
          ? 'Brush stroke'
          : eraserMode === 'reveal'
            ? 'Reveal original'
            : eraserMode === 'restore'
              ? 'Restore masks'
              : eraserMode === 'layer'
                ? 'Erase layer'
                : 'Erase';

    store.end(label);

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
