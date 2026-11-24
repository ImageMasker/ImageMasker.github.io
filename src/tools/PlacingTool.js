// Base for the tools that place things (shapes, arrows, regions, text). They stay selected after
// placing, so several can be drawn in a row, and the layer just placed keeps the Move tool's
// handles: a drag that starts on one of them resizes, rotates or bends it as in the Move tool.
//
// Subclasses implement begin(event), drag(event), finish(event) and cancel().

export class PlacingTool {
  constructor(app) {
    this.app = app;
    this.cursor = 'crosshair';
    this.editing = false;
  }

  get select() {
    return this.app.tools.select;
  }

  activate() {
    this.select.activate();
  }

  deactivate() {
    this.onCancel();
    this.select.deactivate();
  }

  onDown(event) {
    if (this.select.hitHandle(event)) {
      this.editing = true;
      this.select.onDown(event);
      return;
    }

    this.begin(event);
  }

  onMove(event) {
    if (this.editing) {
      this.select.onMove(event);
    } else {
      this.drag(event);
    }
  }

  onUp(event) {
    if (this.editing) {
      this.editing = false;
      this.select.onUp(event);
    } else {
      this.finish(event);
    }
  }

  onCancel() {
    if (this.editing) {
      this.editing = false;
      this.select.onCancel();
    }

    this.cancel();
  }

  onHover(event) {
    this.app.stage.updateCursor(this.select.handleCursor(event) ?? this.cursor);
  }

  begin() {}

  drag() {}

  finish() {}

  cancel() {}
}
