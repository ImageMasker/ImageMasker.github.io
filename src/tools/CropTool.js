// Crop or extend the canvas. The frame may reach outside the picture to add empty space.

import { resizeCanvas } from '../core/model.js';
import { svg } from '../view/Stage.js';

const MIN_SIZE = 16;
const EDGES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', w: 'ew-resize', e: 'ew-resize' };

export class CropTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'crosshair';
    this.rect = null;
    this.drag = null;
    this.group = svg('g', { class: 'crop-overlay' });
    app.stage.overlay.append(this.group);
    app.bus.on('view', () => this.redraw());
  }

  activate() {
    const doc = this.app.store.doc;

    this.rect = { x: 0, y: 0, width: doc.width, height: doc.height };
    this.redraw();
    this.app.bus.emit('crop-changed', this.rect);
  }

  deactivate() {
    this.rect = null;
    this.drag = null;
    this.group.replaceChildren();
  }

  setRect(rect) {
    const limit = this.app.assets.maxSize;

    this.rect = {
      x: rect.x,
      y: rect.y,
      width: Math.max(MIN_SIZE, Math.min(limit, rect.width)),
      height: Math.max(MIN_SIZE, Math.min(limit, rect.height)),
    };
    this.redraw();
    this.app.bus.emit('crop-changed', this.rect);
  }

  /** Sets the frame size from the options bar, keeping it centred. */
  setSize(width, height) {
    const rect = this.rect;

    if (!rect || !(width > 0) || !(height > 0)) {
      return;
    }

    this.setRect({ x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height });
  }

  handles() {
    const stage = this.app.stage;
    const rect = this.rect;

    return EDGES.map((edge) => {
      const x = edge.includes('w') ? rect.x : edge.includes('e') ? rect.x + rect.width : rect.x + rect.width / 2;
      const y = edge.includes('n') ? rect.y : edge.includes('s') ? rect.y + rect.height : rect.y + rect.height / 2;

      return { edge, ...stage.toScreen(x, y) };
    });
  }

  redraw() {
    this.group.replaceChildren();

    if (!this.rect) {
      return;
    }

    const stage = this.app.stage;
    const a = stage.toScreen(this.rect.x, this.rect.y);
    const b = stage.toScreen(this.rect.x + this.rect.width, this.rect.y + this.rect.height);
    const outer = `M0 0H${stage.width}V${stage.height}H0Z`;
    const inner = `M${a.x} ${a.y}H${b.x}V${b.y}H${a.x}Z`;

    this.group.append(svg('path', { d: `${outer} ${inner}`, 'fill-rule': 'evenodd', class: 'crop-shade' }));
    this.group.append(svg('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: 'crop-frame' }));

    for (const handle of this.handles()) {
      this.group.append(svg('rect', { x: handle.x - 5, y: handle.y - 5, width: 10, height: 10, rx: 2, class: 'selection-handle' }));
    }
  }

  hitHandle(event) {
    const reach = event.pointerType === 'touch' ? 18 : 10;

    return this.handles().find((handle) => Math.hypot(event.sx - handle.x, event.sy - handle.y) <= reach) ?? null;
  }

  inside(event) {
    const rect = this.rect;

    return event.x >= rect.x && event.y >= rect.y && event.x <= rect.x + rect.width && event.y <= rect.y + rect.height;
  }

  onDown(event) {
    if (!this.rect) {
      return;
    }

    const handle = this.hitHandle(event);

    this.drag = handle
      ? { kind: 'resize', edge: handle.edge, start: { ...this.rect } }
      : this.inside(event)
        ? { kind: 'move', dx: event.x - this.rect.x, dy: event.y - this.rect.y }
        : { kind: 'draw', x: event.x, y: event.y };
  }

  onMove(event) {
    const drag = this.drag;

    if (!drag) {
      return;
    }

    if (drag.kind === 'move') {
      this.setRect({ ...this.rect, x: event.x - drag.dx, y: event.y - drag.dy });
      return;
    }

    if (drag.kind === 'draw') {
      this.setRect({
        x: Math.min(drag.x, event.x),
        y: Math.min(drag.y, event.y),
        width: Math.abs(event.x - drag.x),
        height: Math.abs(event.y - drag.y),
      });
      return;
    }

    const start = drag.start;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (drag.edge.includes('w')) left = Math.min(event.x, right - MIN_SIZE);
    if (drag.edge.includes('e')) right = Math.max(event.x, left + MIN_SIZE);
    if (drag.edge.includes('n')) top = Math.min(event.y, bottom - MIN_SIZE);
    if (drag.edge.includes('s')) bottom = Math.max(event.y, top + MIN_SIZE);

    this.setRect({ x: left, y: top, width: right - left, height: bottom - top });
  }

  onUp() {
    this.drag = null;
  }

  onCancel() {
    this.drag = null;
  }

  onHover(event) {
    if (!this.rect) {
      return;
    }

    const handle = this.hitHandle(event);

    this.app.stage.updateCursor(handle ? CURSORS[handle.edge] : this.inside(event) ? 'move' : 'crosshair');
  }

  /** Commits the frame as the new canvas. Returns false when nothing would change. */
  apply() {
    const { store } = this.app;
    const doc = store.doc;
    const rect = {
      x: Math.round(this.rect.x),
      y: Math.round(this.rect.y),
      width: Math.max(1, Math.round(this.rect.width)),
      height: Math.max(1, Math.round(this.rect.height)),
    };

    if (rect.x === 0 && rect.y === 0 && rect.width === doc.width && rect.height === doc.height) {
      return false;
    }

    store.apply('Resize canvas', (current) => resizeCanvas(current, rect));
    return true;
  }
}
