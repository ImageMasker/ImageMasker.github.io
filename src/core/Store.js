// Holds the current document, the selection and the undo/redo history.

import { EventBus } from './EventBus.js';
import { createDoc, findLayer, updateLayer } from './model.js';

const HISTORY_LIMIT = 120;

export class Store extends EventBus {
  constructor() {
    super();
    this.doc = createDoc(1, 1);
    this.selection = [];
    this.undoStack = [];
    this.redoStack = [];
    this.gestureBase = null;
    this.hasImage = false;
  }

  layer(id) {
    return findLayer(this.doc, id);
  }

  get selectedLayers() {
    return this.selection.map((id) => this.layer(id)).filter(Boolean);
  }

  get selectedLayer() {
    return this.selection.length === 1 ? this.layer(this.selection[0]) : null;
  }

  /** Starts a gesture (drag, slider scrub). Edits made until end() become one history entry. */
  begin() {
    if (!this.gestureBase) {
      this.gestureBase = { doc: this.doc, selection: this.selection };
    }
  }

  set(doc) {
    if (doc === this.doc) {
      return;
    }

    this.doc = doc;
    this.emit('doc', doc);
  }

  end(label = 'Edit') {
    const base = this.gestureBase;

    this.gestureBase = null;

    if (!base || base.doc === this.doc) {
      return;
    }

    this.undoStack.push({ ...base, label });

    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.emit('history');
  }

  cancel() {
    const base = this.gestureBase;

    this.gestureBase = null;

    if (base) {
      this.set(base.doc);
    }
  }

  /** One-shot edit: `change` receives the document and returns the next one. */
  apply(label, change) {
    this.begin();
    this.set(change(this.doc));
    this.end(label);
  }

  updateLayer(id, patch, label = null) {
    if (label) {
      this.apply(label, (doc) => updateLayer(doc, id, patch));
    } else {
      this.begin();
      this.set(updateLayer(this.doc, id, patch));
    }
  }

  select(ids) {
    const next = (Array.isArray(ids) ? ids : ids ? [ids] : []).filter((id) => this.layer(id));

    if (next.length === this.selection.length && next.every((id, index) => id === this.selection[index])) {
      return;
    }

    this.selection = next;
    this.emit('selection', next);
  }

  step(from, to) {
    const entry = from.pop();

    if (!entry) {
      return false;
    }

    this.gestureBase = null;
    to.push({ doc: this.doc, selection: this.selection, label: entry.label });
    this.doc = entry.doc;
    this.selection = entry.selection.filter((id) => this.layer(id));
    this.emit('doc', this.doc);
    this.emit('selection', this.selection);
    this.emit('history');
    return true;
  }

  undo() {
    return this.step(this.undoStack, this.redoStack);
  }

  redo() {
    return this.step(this.redoStack, this.undoStack);
  }

  /** Replaces the whole document and forgets the history (new image, restored session). */
  reset(doc, hasImage = true) {
    this.gestureBase = null;
    this.undoStack = [];
    this.redoStack = [];
    this.doc = doc;
    this.selection = [];
    this.hasImage = hasImage;
    this.emit('doc', doc);
    this.emit('selection', this.selection);
    this.emit('history');
  }
}
