// "Crop RIS": drag a box over part of the picture; that part (with its masks) is uploaded on its
// own and searched. This is how solvers usually crack a masked round, so hosts can test it.

import { svg } from '../view/Stage.js';

export class RisCropTool {
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
    const { width, height } = this.app.store.doc;
    const x0 = Math.max(0, Math.min(drag.x, event.x));
    const y0 = Math.max(0, Math.min(drag.y, event.y));
    const x1 = Math.min(width, Math.max(drag.x, event.x));
    const y1 = Math.min(height, Math.max(drag.y, event.y));

    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  onDown(event) {
    this.drag = { x: event.x, y: event.y };
  }

  onMove(event) {
    if (!this.drag) {
      return;
    }

    const stage = this.app.stage;
    const rect = this.rectFor(this.drag, event);
    const a = stage.toScreen(rect.x, rect.y);
    const b = stage.toScreen(rect.x + rect.width, rect.y + rect.height);

    this.group.replaceChildren(svg('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: 'region-preview-shape' }));
  }

  onUp(event) {
    const drag = this.drag;

    this.onCancel();

    if (!drag) {
      return;
    }

    const rect = this.rectFor(drag, event);
    const tiny = 12 / this.app.stage.view.zoom;

    if (rect.width < tiny || rect.height < tiny) {
      this.app.notify('Drag a box over the part of the picture to search.', 'info');
      return;
    }

    // Still inside the pointer-up, so the browser lets the waiting RIS tab open.
    this.app.checkRisArea(rect);
    this.app.setTool('select');
  }

  onCancel() {
    this.drag = null;
    this.group.replaceChildren();
  }
}
