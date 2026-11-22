// "Separate one item": draw roughly around something in the picture; only that area is run
// through the background removal and the cut-out is kept inside the drawn outline.

import { svg } from '../view/Stage.js';

export class LassoTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'crosshair';
    this.drag = null;
    this.layerId = null;
    this.group = svg('g', { class: 'region-preview' });
    app.stage.overlay.append(this.group);
  }

  deactivate() {
    this.onCancel();
  }

  onDown(event) {
    this.drag = { points: [event.x, event.y] };
  }

  onMove(event) {
    const drag = this.drag;

    if (!drag) {
      return;
    }

    const stage = this.app.stage;
    const last = drag.points.length - 2;

    if (Math.hypot(event.x - drag.points[last], event.y - drag.points[last + 1]) * stage.view.zoom >= 3) {
      drag.points.push(event.x, event.y);
    }

    const points = [];

    for (let index = 0; index < drag.points.length; index += 2) {
      const point = stage.toScreen(drag.points[index], drag.points[index + 1]);
      points.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`);
    }

    this.group.replaceChildren(svg('polygon', { points: points.join(' '), class: 'region-preview-shape' }));
  }

  onUp() {
    const drag = this.drag;

    this.onCancel();

    if (!drag) {
      return;
    }

    const xs = drag.points.filter((_, index) => index % 2 === 0);
    const ys = drag.points.filter((_, index) => index % 2 === 1);
    const tiny = 12 / this.app.stage.view.zoom;

    if (drag.points.length < 8 || Math.max(...xs) - Math.min(...xs) < tiny || Math.max(...ys) - Math.min(...ys) < tiny) {
      this.app.notify('Draw a loop around the item to separate.', 'info');
      return;
    }

    const layerId = this.layerId;

    this.app.setTool('select');
    void this.app.backgroundTools.remove(layerId, { points: drag.points });
  }

  onCancel() {
    this.drag = null;
    this.group.replaceChildren();
  }
}
