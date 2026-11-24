// Arrow tool: drag from where the arrow starts to where it points. A plain click drops a default
// arrow pointing at the click. Shift keeps the direction to steps of 15°. Once placed, the Move
// tool shows handles for both ends and for the curve.

import { arrowLayer, insertLayer } from '../core/model.js';
import { CURVE_TO_BEND, arrowCurve, headLength, widthToPx } from '../raster/shapes.js';
import { svg } from '../view/Stage.js';

export function snapAngle(from, to) {
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 12)) * (Math.PI / 12);
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

export class ArrowTool {
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

  headFor(event) {
    const point = { x: event.x, y: event.y };

    return event.shift ? snapAngle(this.drag, point) : point;
  }

  onDown(event) {
    this.drag = { x: event.x, y: event.y };
  }

  onMove(event) {
    if (!this.drag) {
      return;
    }

    const { stage, toolState, store } = this.app;
    const state = toolState.arrow;
    const curve = arrowCurve(this.drag, this.headFor(event), state.bend * CURVE_TO_BEND);
    const screen = (point) => stage.toScreen(point.x, point.y);
    const path = Array.from({ length: 25 }, (_, index) => screen(curve.at(index / 24)));
    const tip = path[24];
    const back = path[22];
    const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
    const size = headLength(widthToPx(store.doc, state.width), curve.length) * stage.view.zoom;
    const barb = (side) => `M${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${(tip.x + Math.cos(angle + Math.PI + side * 0.5) * size).toFixed(1)} ${(tip.y + Math.sin(angle + Math.PI + side * 0.5) * size).toFixed(1)}`;
    const d = `M${path.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('L')}${state.head === 'none' ? '' : barb(-1) + barb(1)}`;

    this.group.replaceChildren(svg('path', { d, class: 'region-preview-shape arrow-preview' }));
  }

  onUp(event) {
    const drag = this.drag;
    let head = drag ? this.headFor(event) : null;

    this.onCancel();

    if (!drag) {
      return;
    }

    const { store, stage, toolState } = this.app;
    const state = toolState.arrow;
    const doc = store.doc;
    let tail = { x: drag.x, y: drag.y };

    if (Math.hypot(head.x - tail.x, head.y - tail.y) * stage.view.zoom < 10) {
      // A plain click: a default arrow coming up from the lower left and pointing at the click.
      const side = Math.min(doc.width, doc.height);

      head = { x: drag.x, y: drag.y };
      tail = { x: drag.x - side * 0.14, y: drag.y + side * 0.2 };
    }

    const layer = {
      ...arrowLayer(doc, tail, head, {
        color: state.color,
        width: widthToPx(doc, state.width),
        bend: state.bend * CURVE_TO_BEND,
        head: state.head,
        bothEnds: state.bothEnds,
        style: state.style,
      }),
      opacity: state.opacity / 100,
    };

    store.apply('Add arrow', (current) => insertLayer(current, layer));
    store.select([layer.id]);
    this.app.setTool('select');
  }

  onCancel() {
    this.drag = null;
    this.group.replaceChildren();
  }
}
