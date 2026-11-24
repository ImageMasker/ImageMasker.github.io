// Text tool: click on the picture to type there; click a text to edit it. While typing, a click
// elsewhere only finishes the text. The tool stays selected, and the text keeps its handles
// (PlacingTool).

import { topLayerAt } from '../core/model.js';
import { PlacingTool } from './PlacingTool.js';

export class TextTool extends PlacingTool {
  constructor(app) {
    super(app);
    this.cursor = 'text';
    this.start = null;
  }

  begin(event) {
    const editor = this.app.textEditor;

    // The first click outside the text being typed finishes it rather than starting another.
    this.start = { x: event.x, y: event.y, finishing: Boolean(editor.layerId) };
    editor.close();
  }

  finish(event) {
    const start = this.start;

    this.start = null;

    if (!start || start.finishing) {
      return;
    }

    const { store } = this.app;
    const hit = topLayerAt(store.doc, event.x, event.y);

    if (hit?.type === 'text') {
      store.select([hit.id]);
      this.app.textEditor.open(hit.id);
      return;
    }

    this.app.addTextAt(start.x, start.y);
  }

  cancel() {
    this.start = null;
  }
}
