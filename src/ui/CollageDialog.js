// Collage dialog (header → Collage). Pick a layout made of straight cuts (or draw your own),
// put a picture in each piece, pan/zoom it inside its piece, then create the collage: it becomes
// the base picture and each piece can get its own random mask, clipped to the piece.

import { area, bounds, centroid, contains, COLLAGE_PRESETS, cutPieces, insetPiece, randomCuts, toFlat } from '../collage/layout.js';
import { drawCollage, placement, tracePolygon } from '../collage/render.js';
import { RANDOM_LEVELS } from '../app/randomMask.js';
import { el } from '../utils/dom.js';
import { button, row, select, slider } from './kit.js';
import { Modal } from './Modal.js';

const LONG_SIDE = 2400;
const ASPECTS = [
  { value: '3:2', label: 'Landscape 3:2' },
  { value: '16:9', label: 'Wide 16:9' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '1:1', label: 'Square' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '2:3', label: 'Portrait 2:3' },
];
const PREVIEW_W = 620;
const PREVIEW_H = 440;

export class CollageDialog {
  constructor(app) {
    this.app = app;
    this.aspect = '3:2';
    this.gap = 14;
    this.background = '#ffffff';
    this.cuts = COLLAGE_PRESETS.find((preset) => preset.id === 'crossed').cuts;
    this.cutHistory = [];
    this.slots = [];
    this.leftover = [];
    this.selected = 0;
    this.mode = 'arrange';
    this.mask = true;
    this.modal = new Modal({
      title: 'Collage',
      intro: 'Slice the frame with straight cuts, drop a picture into each piece, then create it. Each picture can get its own mask.',
      className: 'collage-modal',
      onClose: () => document.removeEventListener('paste', this.onPaste),
    });
    this.element = this.modal.element;
    this.refs = {};
    this.onPaste = (event) => this.handlePaste(event);
    this.render();
    this.layout();
  }

  get isOpen() {
    return this.modal.isOpen;
  }

  open() {
    this.modal.open();
    document.addEventListener('paste', this.onPaste);
    this.refs.strength.set(this.app.getRandomSettings().level);
    this.draw();
  }

  // ── geometry ──────────────────────────────────────────────────────────────

  size() {
    const [w, h] = this.aspect.split(':').map(Number);

    return w >= h ? { width: LONG_SIDE, height: Math.round((LONG_SIDE * h) / w) } : { width: Math.round((LONG_SIDE * w) / h), height: LONG_SIDE };
  }

  /** Recomputes the pieces and keeps every picture in the piece that now covers where it was. */
  layout() {
    const { width, height } = this.size();
    const raw = cutPieces(width, height, this.cuts);
    const previous = [...this.slots, ...this.leftover].filter(Boolean);
    const slots = raw.map(() => null);

    this.pieces = raw.map((piece) => {
      const polygon = insetPiece(piece, this.gap, width, height);

      return { raw: piece, polygon, box: polygon ? bounds(polygon) : bounds(piece) };
    });

    const unplaced = [];

    for (const slot of previous) {
      const anchor = { x: slot.anchor.x * width, y: slot.anchor.y * height };
      const index = raw.findIndex((piece, at) => !slots[at] && contains(piece, anchor));

      if (index >= 0) {
        slots[index] = slot;
      } else {
        unplaced.push(slot);
      }
    }

    for (let index = 0; index < slots.length && unplaced.length; index += 1) {
      slots[index] ??= unplaced.shift();
    }

    this.slots = slots;
    this.leftover = unplaced;
    this.slots.forEach((slot, index) => slot && this.anchor(slot, index));
    this.selected = Math.min(this.selected, this.pieces.length - 1);
    this.syncControls();
    this.draw();
  }

  anchor(slot, index) {
    const { width, height } = this.size();
    const centre = centroid(this.pieces[index].raw);

    slot.anchor = { x: centre.x / width, y: centre.y / height };
  }

  // ── layout of the dialog ──────────────────────────────────────────────────

  render() {
    const refs = this.refs;

    refs.canvas = el('canvas', { className: 'collage-canvas', 'aria-label': 'Collage preview. Click a piece to choose its picture, drag to move the picture, scroll to zoom.' });
    refs.fileInput = el('input', { type: 'file', accept: 'image/*', multiple: '', className: 'visually-hidden', 'aria-label': 'Choose pictures' });
    refs.fileInput.addEventListener('change', () => {
      const files = [...(refs.fileInput.files ?? [])];

      refs.fileInput.value = '';
      void this.addFiles(files, this.pickTarget, { replace: true });
    });
    this.bindCanvas();

    refs.arrange = button('Arrange', { iconName: 'select', title: 'Click pieces to choose pictures, drag to move them, scroll to zoom', onClick: () => this.setMode('arrange') });
    refs.cut = button('Draw cuts', { iconName: 'scissors', title: 'Drag a line across the pieces to split them', onClick: () => this.setMode('cut') });
    refs.undoCut = button('Undo cut', { iconName: 'undo', onClick: () => this.undoCut() });
    refs.clearCuts = button('No cuts', { iconName: 'reset', title: 'Start from one whole frame', onClick: () => this.setCuts([]) });
    refs.hint = el('p', { className: 'panel-intro-copy collage-hint' });

    refs.presets = el(
      'div',
      { className: 'collage-presets' },
      COLLAGE_PRESETS.map((preset) => {
        const tile = el('button', { type: 'button', className: 'collage-preset', title: preset.name, 'aria-label': preset.name });

        tile.addEventListener('click', () => this.setCuts(preset.cuts));
        tile.dataset.preset = preset.id;
        return tile;
      })
    );
    refs.randomCuts = button('Random cuts', { iconName: 'dice', className: 'app-button--fill', onClick: () => this.setCuts(randomCuts(this.size().width, this.size().height)) });

    refs.aspect = select({
      label: 'Shape',
      options: ASPECTS,
      value: this.aspect,
      onChange: (value) => {
        this.aspect = value;
        this.renderPresetThumbs();
        this.layout();
      },
    });
    refs.gap = slider({
      label: 'Gap',
      min: 0,
      max: 60,
      value: this.gap,
      format: (value) => `${Math.round(value)} px`,
      onInput: (value) => {
        this.gap = value;
        this.layout();
      },
    });
    refs.background = el('input', { type: 'color', value: this.background, 'aria-label': 'Gap colour' });
    refs.background.addEventListener('input', () => {
      this.background = refs.background.value;
      this.draw();
    });

    refs.pieceLabel = el('div', { className: 'field-label collage-piece-label' });
    refs.zoom = slider({
      label: 'Zoom',
      min: 1,
      max: 4,
      step: 0.05,
      value: 1,
      format: (value) => `${Math.round(value * 100)}%`,
      onInput: (value) => {
        const slot = this.slots[this.selected];

        if (slot) {
          slot.zoom = value;
          this.draw();
        }
      },
    });
    refs.choose = button('Choose…', { iconName: 'image', onClick: () => this.pick(this.selected) });
    refs.remove = button('Remove', { iconName: 'trash', onClick: () => this.removePicture(this.selected) });
    refs.url = el('input', { type: 'url', placeholder: 'or paste an image URL', 'aria-label': 'Image URL for the selected piece' });
    refs.url.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.addUrl(refs.url.value.trim(), this.selected, { replace: true });
      }
    });

    refs.maskToggle = el('input', { type: 'checkbox', 'aria-label': 'Give each picture its own random mask' });
    refs.maskToggle.checked = this.mask;
    refs.maskToggle.addEventListener('change', () => {
      this.mask = refs.maskToggle.checked;
      refs.strength.element.classList.toggle('hidden', !this.mask);
    });
    refs.strength = select({
      label: 'Strength',
      options: RANDOM_LEVELS.map((level) => ({ value: level.id, label: level.label })),
      value: this.app.getRandomSettings().level,
      onChange: (value) => this.app.setRandomSettings({ level: value }),
    });
    refs.status = el('p', { className: 'panel-intro-copy' });
    refs.create = button('Create collage', { iconName: 'sparkle', className: 'app-button--primary', onClick: () => this.create() });

    const group = (title, children) => el('div', { className: 'collage-group' }, [el('div', { className: 'dropdown-title', textContent: title }), ...children]);

    this.modal.body.append(
      el('div', { className: 'collage-layout' }, [
        el('div', { className: 'collage-stage' }, [
          el('div', { className: 'collage-canvas-wrap' }, [refs.canvas]),
          row([refs.arrange, refs.cut, refs.undoCut, refs.clearCuts], 'collage-tools'),
          refs.hint,
          refs.fileInput,
        ]),
        el('div', { className: 'collage-side stack' }, [
          group('Layout', [refs.presets, refs.randomCuts]),
          group('Frame', [refs.aspect.element, refs.gap.element, el('label', { className: 'field field--inline' }, [el('span', { className: 'field-label', textContent: 'Gap colour' }), refs.background])]),
          group('Selected piece', [refs.pieceLabel, row([refs.choose, refs.remove], 'button-row--fill'), refs.url, refs.zoom.element]),
          group('Masks', [
            el('label', { className: 'rounds-toggle' }, [refs.maskToggle, el('span', { textContent: 'Give each picture its own random mask' })]),
            refs.strength.element,
          ]),
          refs.status,
          refs.create,
        ]),
      ])
    );
    this.renderPresetThumbs();
    this.setMode('arrange');
  }

  renderPresetThumbs() {
    const { width, height } = this.size();
    const tw = 64;
    const th = Math.round((tw * height) / width);

    for (const tile of this.refs.presets.children) {
      const preset = COLLAGE_PRESETS.find((entry) => entry.id === tile.dataset.preset);
      const pieces = cutPieces(width, height, preset.cuts);
      const shapes = pieces
        .map((piece) => insetPiece(piece, width * 0.02, width, height))
        .filter(Boolean)
        .map((polygon) => `<polygon points="${polygon.map((point) => `${((point.x / width) * tw).toFixed(1)},${((point.y / height) * th).toFixed(1)}`).join(' ')}"/>`)
        .join('');

      tile.innerHTML = `<svg viewBox="0 0 ${tw} ${th}" width="${tw}" height="${th}" aria-hidden="true">${shapes}</svg>`;
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.refs.arrange.classList.toggle('is-active', mode === 'arrange');
    this.refs.cut.classList.toggle('is-active', mode === 'cut');
    this.refs.canvas.style.cursor = mode === 'cut' ? 'crosshair' : 'pointer';
    this.refs.hint.textContent =
      mode === 'cut'
        ? 'Drag a line through the pieces you want to split. A long line slices right across; a short one only splits the piece it is drawn on.'
        : 'Click a piece to choose its picture (or drop / paste one). Drag to move a picture inside its piece, scroll to zoom.';
    this.draw();
  }

  setCuts(cuts) {
    this.cutHistory.push(this.cuts);
    this.cuts = cuts.map((entry) => ({ a: { ...entry.a }, b: { ...entry.b } }));
    this.layout();
  }

  undoCut() {
    if (this.cutHistory.length) {
      this.cuts = this.cutHistory.pop();
      this.layout();
    }
  }

  syncControls() {
    const { refs } = this;
    const slot = this.slots[this.selected];
    const filled = this.slots.filter(Boolean).length;
    const empty = this.pieces.length - filled;

    refs.pieceLabel.textContent = `Piece ${this.selected + 1} of ${this.pieces.length}${slot ? ` · ${slot.name || 'picture'}` : ' · empty'}`;
    refs.zoom.set(slot?.zoom ?? 1);
    refs.zoom.element.classList.toggle('hidden', !slot);
    refs.remove.disabled = !slot;
    refs.choose.querySelector('span:last-child').textContent = slot ? 'Replace…' : 'Choose…';
    refs.undoCut.disabled = !this.cutHistory.length;
    refs.create.disabled = !filled;
    refs.status.textContent = !filled
      ? 'Add at least one picture.'
      : `${filled} of ${this.pieces.length} pieces have a picture${empty ? `; empty pieces show the gap colour` : ''}.${this.leftover.length ? ` ${this.leftover.length} picture${this.leftover.length === 1 ? '' : 's'} did not fit; add cuts to place ${this.leftover.length === 1 ? 'it' : 'them'}.` : ''}`;
  }

  // ── preview ───────────────────────────────────────────────────────────────

  previewScale() {
    const { width, height } = this.size();

    return Math.min(PREVIEW_W / width, PREVIEW_H / height);
  }

  draw() {
    if (!this.pieces) {
      return;
    }

    const { canvas } = this.refs;
    const { width, height } = this.size();
    const scale = this.previewScale();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * scale * ratio);
    canvas.height = Math.round(height * scale * ratio);
    canvas.style.width = `${Math.round(width * scale)}px`;
    canvas.style.height = `${Math.round(height * scale)}px`;

    const ctx = canvas.getContext('2d');
    const s = scale * ratio;

    drawCollage(ctx, { width, height, pieces: this.pieces, slots: this.slots, background: this.background, scale: s, emptyFill: 'rgba(127, 127, 127, 0.28)' });

    this.pieces.forEach(({ polygon, raw }, index) => {
      const centre = centroid(polygon ?? raw);

      if (!this.slots[index]) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.font = `${Math.round(13 * ratio)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+ Picture ${index + 1}`, centre.x * s, centre.y * s);
      }

      if (index === this.selected && this.mode === 'arrange') {
        tracePolygon(ctx, polygon ?? raw, s);
        ctx.lineWidth = 3 * ratio;
        ctx.strokeStyle = 'rgba(236, 140, 116, 0.95)';
        ctx.setLineDash([8 * ratio, 5 * ratio]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    if (this.cutDrag?.to) {
      const { from, to } = this.cutDrag;

      ctx.beginPath();
      ctx.moveTo(from.x * s, from.y * s);
      ctx.lineTo(to.x * s, to.y * s);
      ctx.lineWidth = 3 * ratio;
      ctx.strokeStyle = '#e5212b';
      ctx.stroke();
    }
  }

  /** Pointer position in full-size collage pixels. */
  toCollage(event) {
    const rect = this.refs.canvas.getBoundingClientRect();
    const scale = this.previewScale();

    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  pieceAt(point) {
    const index = this.pieces.findIndex(({ polygon }) => polygon && contains(polygon, point));

    return index >= 0 ? index : this.pieces.findIndex(({ raw }) => contains(raw, point));
  }

  bindCanvas() {
    const canvas = this.refs.canvas;

    canvas.addEventListener('pointerdown', (event) => {
      const point = this.toCollage(event);

      canvas.setPointerCapture(event.pointerId);

      if (this.mode === 'cut') {
        this.cutDrag = { from: point, to: null };
        return;
      }

      const index = this.pieceAt(point);

      if (index < 0) {
        return;
      }

      this.selected = index;
      this.panDrag = { index, last: point, moved: 0 };
      this.syncControls();
      this.draw();
    });
    canvas.addEventListener('pointermove', (event) => {
      const point = this.toCollage(event);

      if (this.cutDrag) {
        this.cutDrag.to = point;
        this.draw();
        return;
      }

      const drag = this.panDrag;
      const slot = drag && this.slots[drag.index];

      if (!slot) {
        return;
      }

      const box = this.pieces[drag.index].box;
      const spot = placement(slot, box);
      const dx = point.x - drag.last.x;
      const dy = point.y - drag.last.y;

      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.last = point;
      // Spare room is negative when the picture overflows the piece, which is the normal case.
      slot.fx = box.width - spot.width < -0.5 ? Math.max(0, Math.min(1, slot.fx + dx / (box.width - spot.width))) : 0.5;
      slot.fy = box.height - spot.height < -0.5 ? Math.max(0, Math.min(1, slot.fy + dy / (box.height - spot.height))) : 0.5;
      this.draw();
    });
    const finish = (event) => {
      if (this.cutDrag) {
        const { from, to } = this.cutDrag;
        const { width, height } = this.size();

        this.cutDrag = null;

        if (to && Math.hypot(to.x - from.x, to.y - from.y) * this.previewScale() > 12) {
          this.setCuts([...this.cuts, { a: { x: from.x / width, y: from.y / height }, b: { x: to.x / width, y: to.y / height } }]);
        } else {
          this.draw();
        }
        return;
      }

      const drag = this.panDrag;

      this.panDrag = null;

      if (drag && event.type === 'pointerup' && drag.moved * this.previewScale() < 4 && !this.slots[drag.index]) {
        this.pick(drag.index);
      }
    };

    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('dblclick', (event) => {
      const index = this.pieceAt(this.toCollage(event));

      if (index >= 0 && this.mode === 'arrange') {
        this.pick(index);
      }
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        if (this.mode !== 'arrange') {
          return;
        }

        const index = this.pieceAt(this.toCollage(event));
        const slot = this.slots[index];

        if (!slot) {
          return;
        }

        event.preventDefault();
        slot.zoom = Math.max(1, Math.min(4, slot.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
        this.selected = index;
        this.syncControls();
        this.draw();
      },
      { passive: false }
    );
    canvas.addEventListener('dragover', (event) => {
      if ([...(event.dataTransfer?.types ?? [])].includes('Files')) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    canvas.addEventListener('drop', (event) => {
      const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'));

      event.preventDefault();
      event.stopPropagation();

      if (files.length) {
        void this.addFiles(files, this.pieceAt(this.toCollage(event)), { replace: true });
      }
    });
  }

  // ── pictures ──────────────────────────────────────────────────────────────

  pick(index) {
    this.pickTarget = index;
    this.refs.fileInput.click();
  }

  /** Puts a picture in `target` (if empty, or always with `replace`), else in the first empty piece. */
  place(slot, target, { replace = false } = {}) {
    const valid = target >= 0 && target < this.pieces.length;
    const index = valid && (replace || !this.slots[target]) ? target : this.slots.findIndex((entry) => !entry);

    if (index < 0) {
      this.leftover.push({ ...slot, anchor: { x: -1, y: -1 } });
      return -1;
    }

    this.slots[index] = slot;
    this.anchor(slot, index);
    return index;
  }

  async decode(blob, name) {
    const source = await createImageBitmap(blob);

    return { source, width: source.width, height: source.height, name, zoom: 1, fx: 0.5, fy: 0.5, anchor: { x: 0, y: 0 } };
  }

  /** The first file goes to `target`, the others into empty pieces. */
  async addFiles(files, target = -1, { replace = false } = {}) {
    let placed = -1;

    for (const [order, file] of files.entries()) {
      try {
        const slot = await this.decode(file, file.name.replace(/\.[^.]+$/, ''));
        const index = this.place(slot, order === 0 ? target : -1, { replace: order === 0 && replace });

        placed = placed < 0 ? index : placed;
      } catch (error) {
        console.error(error);
        this.app.notify(`${file.name || 'That file'} could not be read as a picture.`, 'error');
      }
    }

    if (placed >= 0) {
      this.selected = placed;
    }

    this.syncControls();
    this.draw();
  }

  async addUrl(url, target, { replace = false } = {}) {
    if (!/^https?:\/\/\S+$/i.test(url)) {
      this.app.notify('Enter the full image URL (https://…).', 'warning');
      return;
    }

    try {
      const asset = await this.app.assets.fromUrl(url, { name: 'Collage picture' });

      const index = this.place({ source: asset.source, width: asset.width, height: asset.height, name: url.split('/').pop().slice(0, 40), zoom: 1, fx: 0.5, fy: 0.5, anchor: { x: 0, y: 0 } }, target, { replace });

      this.selected = index >= 0 ? index : this.selected;
      this.refs.url.value = '';
      this.syncControls();
      this.draw();
    } catch (error) {
      console.error(error);
      this.app.notify('That image URL could not be loaded.', 'error');
    }
  }

  handlePaste(event) {
    if (!this.isOpen || event.target === this.refs.url) {
      return;
    }

    const items = [...(event.clipboardData?.items ?? [])];
    const files = items.filter((item) => item.kind === 'file' && item.type.startsWith('image/')).map((item) => item.getAsFile()).filter(Boolean);
    const text = event.clipboardData?.getData('text/plain').trim() ?? '';

    if (files.length) {
      event.preventDefault();
      void this.addFiles(files, this.slots[this.selected] ? -1 : this.selected);
    } else if (/^https?:\/\/\S+$/i.test(text)) {
      event.preventDefault();
      void this.addUrl(text, this.slots[this.selected] ? -1 : this.selected);
    }
  }

  removePicture(index) {
    this.slots[index] = null;

    if (this.leftover.length) {
      this.place(this.leftover.shift(), index);
    }

    this.syncControls();
    this.draw();
  }

  // ── create ────────────────────────────────────────────────────────────────

  async create() {
    const { width, height } = this.size();
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;
    drawCollage(canvas.getContext('2d'), { width, height, pieces: this.pieces, slots: this.slots, background: this.background });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const cells = this.pieces
      .filter(({ polygon }, index) => polygon && this.slots[index] && Math.abs(area(polygon)) > width * height * 0.002)
      .map(({ polygon }) => toFlat(polygon));

    this.refs.create.disabled = true;

    try {
      if (await this.app.openCollage(blob, { width, height, cells, mask: this.mask })) {
        this.modal.close();
      }
    } finally {
      this.refs.create.disabled = false;
    }
  }
}
