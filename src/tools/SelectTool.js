// Move / resize / rotate layers directly on the canvas. A selected arrow gets handles for its two
// ends and one in the middle of its curve instead of the box handles.

import { apply, invert, layerAxes, layerCorners, layerMatrix } from '../core/geometry.js';
import { arrowEndPoints, findLayer, isBoxLayer, placeArrow, topLayerAt, updateLayer } from '../core/model.js';
import { getEffect } from '../gl/effects.js';
import { arrowCurve, arrowEnds, curveThrough } from '../raster/shapes.js';
import { measureText } from '../raster/text.js';
import { svg } from '../view/Stage.js';
import { snapAngle } from './ArrowTool.js';

const HANDLES = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
const ROTATE_OFFSET = 28;
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const KEEP_ASPECT = new Set(['image', 'mask', 'text']);

export class SelectTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'default';
    this.active = false;
    this.drag = null;
    this.group = svg('g', { class: 'selection-overlay' });
    app.stage.overlay.append(this.group);

    const redraw = () => this.redraw();

    app.bus.on('view', redraw);
    app.store.on('doc', redraw);
    app.store.on('selection', redraw);
    app.bus.on('collage-target', redraw);
  }

  /** Outlines the collage piece the selected layer is limited to, or the one new masks go to. */
  drawPiece() {
    const { app } = this;
    const cells = app.collageCells();
    const layer = app.store.selectedLayer;
    const piece = layer ? layer.clip?.piece : app.activeCollageTarget();
    const cell = cells && piece !== null && piece !== undefined ? cells[piece] : null;

    if (!cell) {
      return;
    }

    const screen = [];

    for (let index = 0; index < cell.points.length; index += 2) {
      screen.push(app.stage.toScreen(cell.points[index], cell.points[index + 1]));
    }

    const points = screen.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const corner = app.stage.toScreen(cell.rect.x, cell.rect.y);
    const text = svg('text', { x: corner.x + 10, y: corner.y + 22, class: 'piece-label' });

    text.textContent = layer ? `Picture ${piece + 1}` : `New masks → picture ${piece + 1}`;
    this.group.append(svg('polygon', { points, class: 'piece-outline piece-outline--back' }), svg('polygon', { points, class: 'piece-outline' }), text);
  }

  activate() {
    this.active = true;
    this.redraw();
  }

  deactivate() {
    this.active = false;
    this.drag = null;
    this.redraw();
  }

  /** The single selected layer when it can be transformed with handles. */
  handleLayer() {
    const layer = this.app.store.selectedLayer;

    return this.active && layer && isBoxLayer(layer) && layer.type !== 'arrow' && !layer.locked && layer.visible ? layer : null;
  }

  /** The single selected arrow, when its ends and curve can be dragged. */
  arrowLayer() {
    const layer = this.app.store.selectedLayer;

    return this.active && layer?.type === 'arrow' && !layer.locked && layer.visible ? layer : null;
  }

  /** Screen positions of an arrow's tail, head and the middle of its curve. */
  arrowHandles(layer) {
    const [a, b] = arrowEnds(layer);
    const middle = arrowCurve(a, b, layer.bend || 0, layer.lean || 0).at(0.5);
    const matrix = layerMatrix(layer);
    const screen = (point) => {
      const doc = apply(matrix, point.x / layer.w, point.y / layer.h);

      return this.app.stage.toScreen(doc.x, doc.y);
    };

    return { arrowTail: screen(a), arrowHead: screen(b), arrowBend: screen(middle) };
  }

  /** Selected effect whose centre can be dragged, and where that centre is on screen. */
  centreHandle() {
    const layer = this.app.store.selectedLayer;

    if (!this.active || !layer || layer.type !== 'effect' || layer.locked || !layer.visible || !getEffect(layer.effectId).centered) {
      return null;
    }

    const point = apply(layerMatrix(layer), layer.center?.x ?? 0, layer.center?.y ?? 0);

    return { layer, ...this.app.stage.toScreen(point.x, point.y) };
  }

  handlePoints(layer) {
    const stage = this.app.stage;
    const matrix = layerMatrix(layer);
    const toScreen = (lx, ly) => {
      const point = apply(matrix, lx, ly);
      return stage.toScreen(point.x, point.y);
    };
    const handles = HANDLES.map(([hx, hy]) => ({ hx, hy, ...toScreen(hx / 2, hy / 2) }));
    const top = toScreen(0, -0.5);
    const center = toScreen(0, 0);
    const length = Math.hypot(top.x - center.x, top.y - center.y) || 1;
    const rotate = {
      x: top.x + ((top.x - center.x) / length) * ROTATE_OFFSET,
      y: top.y + ((top.y - center.y) / length) * ROTATE_OFFSET,
    };

    return { handles, rotate, top, center };
  }

  redraw() {
    const { store, stage } = this.app;

    this.group.replaceChildren();

    if (!this.active || !store.hasImage || this.app.textEditor?.layerId) {
      return;
    }

    this.drawPiece();

    const arrow = this.arrowLayer();

    for (const layer of store.selectedLayers) {
      if (!isBoxLayer(layer) || !layer.visible || layer === arrow) {
        continue;
      }

      const points = layerCorners(layer)
        .map((corner) => stage.toScreen(corner.x, corner.y))
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' ');

      this.group.append(svg('polygon', { points, class: 'selection-outline selection-outline--back' }));
      this.group.append(svg('polygon', { points, class: 'selection-outline' }));
    }

    const centre = this.centreHandle();

    if (centre) {
      const { x, y } = centre;

      this.group.append(svg('circle', { cx: x, cy: y, r: 9, class: 'centre-handle-back' }));
      this.group.append(svg('circle', { cx: x, cy: y, r: 9, class: 'centre-handle' }));
      this.group.append(svg('path', { d: `M${x - 14} ${y}H${x + 14}M${x} ${y - 14}V${y + 14}`, class: 'centre-handle-cross' }));
    }

    if (arrow) {
      const { arrowTail, arrowHead, arrowBend } = this.arrowHandles(arrow);

      this.group.append(
        svg('circle', { cx: arrowTail.x, cy: arrowTail.y, r: 6, class: 'selection-handle' }),
        svg('circle', { cx: arrowHead.x, cy: arrowHead.y, r: 7, class: 'selection-handle' }),
        svg('circle', { cx: arrowBend.x, cy: arrowBend.y, r: 6, class: 'selection-handle selection-handle--rotate' })
      );
    }

    const layer = this.handleLayer();

    if (!layer) {
      return;
    }

    const { handles, rotate, top } = this.handlePoints(layer);

    this.group.append(svg('line', { x1: top.x, y1: top.y, x2: rotate.x, y2: rotate.y, class: 'selection-stem' }));
    this.group.append(svg('circle', { cx: rotate.x, cy: rotate.y, r: 6, class: 'selection-handle selection-handle--rotate' }));

    for (const handle of handles) {
      this.group.append(svg('rect', { x: handle.x - 5, y: handle.y - 5, width: 10, height: 10, rx: 2, class: 'selection-handle' }));
    }
  }

  hitHandle(event) {
    const reach = event.pointerType === 'touch' ? 18 : 10;
    const centre = this.centreHandle();

    if (centre && Math.hypot(event.sx - centre.x, event.sy - centre.y) <= reach + 4) {
      return { kind: 'centre', layer: centre.layer };
    }

    const arrow = this.arrowLayer();

    if (arrow) {
      const handles = this.arrowHandles(arrow);
      const kind = ['arrowHead', 'arrowTail', 'arrowBend'].find((key) => Math.hypot(event.sx - handles[key].x, event.sy - handles[key].y) <= reach);

      return kind ? { kind, layer: arrow } : null;
    }

    const layer = this.handleLayer();

    if (!layer) {
      return null;
    }

    const { handles, rotate } = this.handlePoints(layer);

    if (Math.hypot(event.sx - rotate.x, event.sy - rotate.y) <= reach) {
      return { kind: 'rotate', layer };
    }

    const handle = handles.find((entry) => Math.hypot(event.sx - entry.x, event.sy - entry.y) <= reach);

    return handle ? { kind: 'resize', layer, hx: handle.hx, hy: handle.hy } : null;
  }

  onDown(event) {
    const { store } = this.app;
    const handle = this.hitHandle(event);

    if (handle) {
      this.drag = { ...handle, start: handle.layer, startX: event.x, startY: event.y, moved: false };
      return;
    }

    const hit = topLayerAt(store.doc, event.x, event.y);

    if (!hit) {
      if (!event.shift) {
        store.select([]);
      }
      return;
    }

    if (event.shift) {
      store.select(store.selection.includes(hit.id) ? store.selection.filter((id) => id !== hit.id) : [...store.selection, hit.id]);
    } else if (!store.selection.includes(hit.id)) {
      store.select([hit.id]);
    }

    const layers = store.selectedLayers.filter((layer) => isBoxLayer(layer) && !layer.locked);

    if (layers.length && store.selection.includes(hit.id)) {
      this.drag = { kind: 'move', layers, startX: event.x, startY: event.y, sx: event.sx, sy: event.sy, moved: false };
    }
  }

  onMove(event) {
    const drag = this.drag;

    if (!drag) {
      return;
    }

    const { store } = this.app;

    if (drag.kind === 'move') {
      if (!drag.moved && Math.hypot(event.sx - drag.sx, event.sy - drag.sy) < 3) {
        return;
      }

      let dx = event.x - drag.startX;
      let dy = event.y - drag.startY;

      if (event.shift) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }

      drag.moved = true;
      store.begin();
      store.set(drag.layers.reduce((doc, layer) => updateLayer(doc, layer.id, { x: layer.x + dx, y: layer.y + dy }), store.gestureBase.doc));
      return;
    }

    drag.moved = true;
    store.begin();

    if (drag.kind === 'centre') {
      const local = apply(invert(layerMatrix(drag.start)), event.x, event.y);

      store.set(updateLayer(store.gestureBase.doc, drag.start.id, { center: { x: local.x, y: local.y } }));
      return;
    }

    if (drag.kind.startsWith('arrow')) {
      store.set(updateLayer(store.gestureBase.doc, drag.start.id, this.arrowPatch(drag, event)));
      return;
    }

    store.set(updateLayer(store.gestureBase.doc, drag.start.id, drag.kind === 'rotate' ? this.rotatePatch(drag, event) : this.resizePatch(drag, event)));
  }

  /** Moves one end of an arrow (Shift: in steps of 15°) or bends it through the middle handle. */
  arrowPatch(drag, event) {
    const start = drag.start;
    const [tail, head] = arrowEndPoints(start);
    const point = { x: event.x, y: event.y };

    if (drag.kind === 'arrowTail') {
      return placeArrow(start, event.shift ? snapAngle(head, point) : point, head);
    }

    if (drag.kind === 'arrowHead') {
      return placeArrow(start, tail, event.shift ? snapAngle(tail, point) : point);
    }

    // The middle handle goes wherever it is dragged, and the curve passes through it.
    const local = apply(invert(layerAxes(start)), event.x - start.x, event.y - start.y);
    const [a, b] = arrowEnds(start);
    let { bend, lean } = curveThrough(a, b, local);

    // Shift (or nearly on the line) makes it straight.
    if (event.shift || (Math.abs(bend) < 0.02 && Math.abs(lean) < 0.02)) {
      bend = 0;
      lean = 0;
    }

    return placeArrow({ ...start, bend: Math.max(-1, Math.min(1, bend)), lean: Math.max(-1, Math.min(1, lean)) }, tail, head);
  }

  rotatePatch(drag, event) {
    const start = drag.start;
    // The rotate handle sits "above" the layer, i.e. at -90 degrees when unrotated.
    let rotation = Math.atan2(event.y - start.y, event.x - start.x) + Math.PI / 2;

    if (event.shift) {
      rotation = Math.round(rotation / (Math.PI / 12)) * (Math.PI / 12);
    }

    return { rotation };
  }

  resizePatch(drag, event) {
    const start = drag.start;
    const { hx, hy } = drag;
    const axes = layerAxes(start);
    const anchor = apply(layerMatrix(start), -hx / 2, -hy / 2);
    const local = apply(invert(axes), event.x - anchor.x, event.y - anchor.y);
    const minimum = 4 / this.app.stage.view.zoom;
    let w = hx ? Math.max(minimum, hx * local.x) : start.w;
    let h = hy ? Math.max(minimum, hy * local.y) : start.h;

    if (hx && hy && KEEP_ASPECT.has(start.type) !== event.shift) {
      const scale = Math.max(w / start.w, h / start.h);

      w = start.w * scale;
      h = start.h * scale;
    }

    const offset = apply(axes, (hx * w) / 2, (hy * h) / 2);
    const patch = { x: anchor.x + offset.x, y: anchor.y + offset.y, w, h };

    if (start.type === 'text') {
      const natural = measureText(start);

      patch.sx = w / natural.width;
      patch.sy = h / natural.height;
    } else if (start.type === 'mask' && start.natW) {
      patch.zoom = Math.max(0, Math.min(100, 50 + (50 * Math.log(w / start.natW)) / Math.log(4)));
    }

    return patch;
  }

  onUp() {
    const drag = this.drag;

    this.drag = null;

    if (drag?.moved) {
      this.app.store.end({ move: 'Move', rotate: 'Rotate', centre: 'Move centre', arrowTail: 'Move arrow end', arrowHead: 'Move arrow end', arrowBend: 'Curve arrow' }[drag.kind] ?? 'Resize');
    }
  }

  onCancel() {
    this.drag = null;
    this.app.store.cancel();
  }

  /** The cursor for the handle under the pointer, or null when there is none (also used by PlacingTool). */
  handleCursor(event) {
    const handle = this.hitHandle(event);

    if (!handle) {
      return null;
    }

    if (handle.kind === 'centre' || handle.kind.startsWith('arrow')) {
      return 'move';
    }

    if (handle.kind === 'rotate') {
      return 'crosshair';
    }

    const direction = apply(layerAxes(handle.layer), handle.hx, handle.hy);
    const angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;

    return RESIZE_CURSORS[((Math.round(angle / 45) % 4) + 4) % 4];
  }

  onHover(event) {
    const cursor = this.handleCursor(event) ?? (topLayerAt(this.app.store.doc, event.x, event.y) ? 'move' : 'default');

    this.app.stage.updateCursor(cursor);
  }

  onDoubleClick(event) {
    const hit = topLayerAt(this.app.store.doc, event.x, event.y);

    if (hit?.type === 'text') {
      this.app.store.select([hit.id]);
      this.app.textEditor.open(hit.id);
    }
  }

  /** Keeps the tool's drag target in sync when the layer vanishes mid-gesture (undo, delete). */
  validate() {
    if (this.drag?.start && !findLayer(this.app.store.doc, this.drag.start.id)) {
      this.drag = null;
    }
  }
}
