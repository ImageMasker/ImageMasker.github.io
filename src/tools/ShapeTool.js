// Shapes tool: drag out a circle, rectangle, triangle, star or heart (outline or filled, hand-drawn
// or clean). A plain click drops a default-sized one where the pointer is. The tool stays selected,
// and the shape just drawn keeps its handles (PlacingTool).

import { insertLayer, shapeLayer } from '../core/model.js';
import { shapeOutline, widthToPx } from '../raster/shapes.js';
import { svg } from '../view/Stage.js';
import { PlacingTool } from './PlacingTool.js';

export class ShapeTool extends PlacingTool {
  constructor(app) {
    super(app);
    this.start = null;
    this.group = svg('g', { class: 'region-preview' });
    app.stage.overlay.append(this.group);
  }

  rectFor(start, event) {
    let width = event.x - start.x;
    let height = event.y - start.y;

    if (event.shift) {
      const side = Math.max(Math.abs(width), Math.abs(height));

      width = Math.sign(width || 1) * side;
      height = Math.sign(height || 1) * side;
    }

    return { x: Math.min(start.x, start.x + width), y: Math.min(start.y, start.y + height), width: Math.abs(width), height: Math.abs(height) };
  }

  begin(event) {
    this.start = { x: event.x, y: event.y };
  }

  drag(event) {
    if (!this.start) {
      return;
    }

    const rect = this.rectFor(this.start, event);
    const stage = this.app.stage;
    const points = shapeOutline(this.app.toolState.shape.kind)
      .filter((_, index) => index % 2 === 0)
      .map(([x, y]) => stage.toScreen(rect.x + ((x + 1) / 2) * rect.width, rect.y + ((y + 1) / 2) * rect.height))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`);

    this.group.replaceChildren(svg('polygon', { points: points.join(' '), class: 'region-preview-shape' }));
  }

  finish(event) {
    const start = this.start;

    this.cancel();

    if (!start) {
      return;
    }

    const { store, stage, toolState } = this.app;
    const state = toolState.shape;
    const doc = store.doc;
    let rect = this.rectFor(start, event);

    if (rect.width < 8 / stage.view.zoom || rect.height < 8 / stage.view.zoom) {
      // A plain click: a default-sized shape centred on the pointer.
      const side = Math.min(doc.width, doc.height) * 0.3;
      const width = state.kind === 'rect' ? side * 1.3 : side;
      const height = state.kind === 'rect' ? side * 0.9 : side;

      rect = { x: start.x - width / 2, y: start.y - height / 2, width, height };
    }

    const layer = {
      ...shapeLayer(doc, rect, { kind: state.kind, fill: state.fill, style: state.style, color: state.color, width: widthToPx(doc, state.width) }),
      opacity: state.opacity / 100,
    };

    store.apply(`Add ${layer.name.toLowerCase()}`, (current) => insertLayer(current, layer));
    store.select([layer.id]);
  }

  cancel() {
    this.start = null;
    this.group.replaceChildren();
  }
}
