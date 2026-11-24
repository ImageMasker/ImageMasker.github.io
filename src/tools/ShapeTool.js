// Shapes tool: drag out a circle, rectangle, triangle, star or heart (outline or filled, hand-drawn
// or clean). A plain click drops a default-sized one where the pointer is.

import { insertLayer, shapeLayer } from '../core/model.js';
import { shapeOutline, widthToPx } from '../raster/shapes.js';
import { svg } from '../view/Stage.js';

export class ShapeTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'crosshair';
    this.drag = null;
    this.group = svg('g', { class: 'region-preview' });
    app.stage.overlay.append(this.group);
  }

  deactivate() {
    this.onCancel();
  }

  rectFor(drag, event) {
    let width = event.x - drag.x;
    let height = event.y - drag.y;

    if (event.shift) {
      const side = Math.max(Math.abs(width), Math.abs(height));

      width = Math.sign(width || 1) * side;
      height = Math.sign(height || 1) * side;
    }

    return { x: Math.min(drag.x, drag.x + width), y: Math.min(drag.y, drag.y + height), width: Math.abs(width), height: Math.abs(height) };
  }

  onDown(event) {
    this.drag = { x: event.x, y: event.y };
  }

  onMove(event) {
    if (!this.drag) {
      return;
    }

    const rect = this.rectFor(this.drag, event);
    const stage = this.app.stage;
    const points = shapeOutline(this.app.toolState.shape.kind)
      .filter((_, index) => index % 2 === 0)
      .map(([x, y]) => stage.toScreen(rect.x + ((x + 1) / 2) * rect.width, rect.y + ((y + 1) / 2) * rect.height))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`);

    this.group.replaceChildren(svg('polygon', { points: points.join(' '), class: 'region-preview-shape' }));
  }

  onUp(event) {
    const drag = this.drag;

    this.onCancel();

    if (!drag) {
      return;
    }

    const { store, stage, toolState } = this.app;
    const state = toolState.shape;
    const doc = store.doc;
    let rect = this.rectFor(drag, event);

    if (rect.width < 8 / stage.view.zoom || rect.height < 8 / stage.view.zoom) {
      // A plain click: a default-sized shape centred on the pointer.
      const side = Math.min(doc.width, doc.height) * 0.3;
      const width = state.kind === 'rect' ? side * 1.3 : side;
      const height = state.kind === 'rect' ? side * 0.9 : side;

      rect = { x: drag.x - width / 2, y: drag.y - height / 2, width, height };
    }

    const layer = {
      ...shapeLayer(doc, rect, { kind: state.kind, fill: state.fill, style: state.style, color: state.color, width: widthToPx(doc, state.width) }),
      opacity: state.opacity / 100,
    };

    store.apply(`Add ${layer.name.toLowerCase()}`, (current) => insertLayer(current, layer));
    store.select([layer.id]);
    this.app.setTool('select');
  }

  onCancel() {
    this.drag = null;
    this.group.replaceChildren();
  }
}
