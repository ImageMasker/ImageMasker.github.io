// Arrow tool: drag from where the arrow starts to what it points at. The arrow is an arch that
// follows how the drag curved (a mostly straight drag gives a straight arrow); Shift keeps it
// straight and the direction to steps of 15°. A plain click drops a default arrow pointing at the
// click. The tool stays selected, and the arrow just drawn keeps its handles (PlacingTool).

import { arrowLayer, insertLayer } from '../core/model.js';
import { CURVE_TO_BEND, arrowCurve, fitCurve, headLength, widthToPx } from '../raster/shapes.js';
import { svg } from '../view/Stage.js';
import { PlacingTool } from './PlacingTool.js';

export function snapAngle(from, to) {
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 12)) * (Math.PI / 12);
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

export class ArrowTool extends PlacingTool {
  constructor(app) {
    super(app);
    this.stroke = null;
    this.group = svg('g', { class: 'region-preview' });
    app.stage.overlay.append(this.group);
  }

  /** Where the arrow goes and how much it bends, for the drag so far. */
  shape(event) {
    const path = this.stroke.path;
    const point = { x: event.x, y: event.y };
    const head = event.shift ? snapAngle(path[0], point) : point;

    return { tail: path[0], head, ...(event.shift ? { bend: 0, lean: 0 } : fitCurve(path[0], head, [...path, point])) };
  }

  begin(event) {
    this.stroke = { path: [{ x: event.x, y: event.y }] };
  }

  drag(event) {
    const stroke = this.stroke;

    if (!stroke) {
      return;
    }

    const { stage, toolState, store } = this.app;
    const last = stroke.path[stroke.path.length - 1];

    if (Math.hypot(event.x - last.x, event.y - last.y) * stage.view.zoom >= 3) {
      stroke.path.push({ x: event.x, y: event.y });
    }

    const state = toolState.arrow;
    const { tail, head, bend, lean } = this.shape(event);
    const curve = arrowCurve(tail, head, bend, lean);
    const screen = (point) => stage.toScreen(point.x, point.y);
    const path = Array.from({ length: 25 }, (_, index) => screen(curve.at(index / 24)));
    const tip = path[24];
    const back = path[22];
    const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
    const size = headLength(widthToPx(store.doc, state.width), curve.length) * stage.view.zoom;
    const barb = (side) =>
      `M${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${(tip.x + Math.cos(angle + Math.PI + side * 0.5) * size).toFixed(1)} ${(tip.y + Math.sin(angle + Math.PI + side * 0.5) * size).toFixed(1)}`;
    const d = `M${path.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('L')}${state.head === 'none' ? '' : barb(-1) + barb(1)}`;

    this.group.replaceChildren(svg('path', { d, class: 'region-preview-shape arrow-preview' }));
  }

  finish(event) {
    if (!this.stroke) {
      return;
    }

    const { store, stage, toolState } = this.app;
    const state = toolState.arrow;
    const doc = store.doc;
    let { tail, head, bend, lean } = this.shape(event);

    this.cancel();

    if (Math.hypot(head.x - tail.x, head.y - tail.y) * stage.view.zoom < 10) {
      // A plain click: a default arrow coming up from the lower left and pointing at the click.
      const side = Math.min(doc.width, doc.height);

      head = { x: event.x, y: event.y };
      tail = { x: event.x - side * 0.14, y: event.y + side * 0.2 };
      bend = state.bend * CURVE_TO_BEND;
      lean = 0;
    }

    const layer = {
      ...arrowLayer(doc, tail, head, { color: state.color, width: widthToPx(doc, state.width), bend, lean, head: state.head, bothEnds: state.bothEnds, style: state.style }),
      opacity: state.opacity / 100,
    };

    store.apply('Add arrow', (current) => insertLayer(current, layer));
    store.select([layer.id]);
  }

  cancel() {
    this.stroke = null;
    this.group.replaceChildren();
  }
}
