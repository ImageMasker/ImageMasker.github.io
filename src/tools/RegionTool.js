// Drag out a rectangle, ellipse or freehand shape; it becomes an effect region. The tool stays
// selected, and the region just added keeps its handles (PlacingTool).

import { effectLayer, insertMask } from '../core/model.js';
import { svg } from '../view/Stage.js';
import { PlacingTool } from './PlacingTool.js';

export class RegionTool extends PlacingTool {
  constructor(app) {
    super(app);
    this.region = null;
    this.group = svg('g', { class: 'region-preview' });
    app.stage.overlay.append(this.group);
  }

  rectFor(drag, event) {
    let width = event.x - drag.x;
    let height = event.y - drag.y;

    if (event.shift) {
      const side = Math.max(Math.abs(width), Math.abs(height));

      width = Math.sign(width || 1) * side;
      height = Math.sign(height || 1) * side;
    }

    return {
      x: Math.min(drag.x, drag.x + width),
      y: Math.min(drag.y, drag.y + height),
      width: Math.abs(width),
      height: Math.abs(height),
    };
  }

  begin(event) {
    this.region = { x: event.x, y: event.y, shape: this.app.toolState.region.shape, points: [event.x, event.y] };
  }

  drag(event) {
    const drag = this.region;

    if (!drag) {
      return;
    }

    const stage = this.app.stage;

    this.group.replaceChildren();

    if (drag.shape === 'freehand') {
      const last = drag.points.length - 2;

      if (Math.hypot(event.x - drag.points[last], event.y - drag.points[last + 1]) * stage.view.zoom >= 3) {
        drag.points.push(event.x, event.y);
      }

      const points = [];

      for (let index = 0; index < drag.points.length; index += 2) {
        const point = stage.toScreen(drag.points[index], drag.points[index + 1]);
        points.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`);
      }

      this.group.append(svg('polygon', { points: points.join(' '), class: 'region-preview-shape' }));
      return;
    }

    const rect = this.rectFor(drag, event);
    const a = stage.toScreen(rect.x, rect.y);
    const b = stage.toScreen(rect.x + rect.width, rect.y + rect.height);

    this.group.append(
      drag.shape === 'ellipse'
        ? svg('ellipse', { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rx: (b.x - a.x) / 2, ry: (b.y - a.y) / 2, class: 'region-preview-shape' })
        : svg('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: 'region-preview-shape' })
    );
  }

  finish(event) {
    const drag = this.region;

    this.cancel();

    if (!drag) {
      return;
    }

    const { store, stage, toolState } = this.app;
    const doc = store.doc;
    const tiny = 8 / stage.view.zoom;
    let rect;
    let points = null;
    let coverage = drag.shape === 'ellipse' ? 'ellipse' : 'rect';

    if (drag.shape === 'freehand' && drag.points.length >= 8) {
      const xs = drag.points.filter((_, index) => index % 2 === 0);
      const ys = drag.points.filter((_, index) => index % 2 === 1);

      rect = { x: Math.min(...xs), y: Math.min(...ys) };
      rect.width = Math.max(...xs) - rect.x;
      rect.height = Math.max(...ys) - rect.y;

      if (rect.width > tiny && rect.height > tiny) {
        coverage = 'polygon';
        points = drag.points.map((value, index) =>
          index % 2 === 0 ? (value - rect.x) / rect.width - 0.5 : (value - rect.y) / rect.height - 0.5
        );
      }
    } else if (drag.shape !== 'freehand') {
      rect = this.rectFor(drag, event);
    }

    if (!rect || rect.width < tiny || rect.height < tiny) {
      // A plain click drops a default-sized region where the pointer is.
      const width = doc.width * 0.3;
      const height = drag.shape === 'ellipse' ? width : doc.height * 0.25;

      rect = { x: drag.x - width / 2, y: drag.y - height / 2, width, height };
      coverage = drag.shape === 'ellipse' ? 'ellipse' : 'rect';
      points = null;
    }

    const layer = effectLayer(doc, toolState.region.effectId, { coverage, rect, points });

    store.apply('Add region', (current) => insertMask(current, layer));
    store.select([layer.id]);
  }

  cancel() {
    this.region = null;
    this.group.replaceChildren();
  }
}
