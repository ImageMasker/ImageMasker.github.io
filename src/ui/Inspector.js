// Properties panel: options for the active tool and for the selected layer(s). The controls are
// rebuilt only when the kind of thing being edited changes; otherwise their values are synced.

import { emojiLayerName, fitText, updateLayer, zoomFactor } from '../core/model.js';
import { EFFECT_CATEGORIES, EFFECTS, getEffect, defaultParams, hasIntensity, INTENSITY_LEVELS, intensityParams } from '../gl/effects.js';
import { BLEND_MODES } from '../gl/glsl.js';
import { getPattern } from '../gl/patterns.js';
import { EMOJI_MASK, randomEmojis, sameEmoji } from '../masks/emojiData.js';
import { REPEAT_DEFAULTS } from '../raster/repeat.js';
import { BRUSH_TYPES } from '../raster/strokes.js';
import { PAINT_AMOUNT } from '../tools/BrushTool.js';
import { STAMP_DRAG_MODES } from '../tools/StampTool.js';
import { EMOJI_STYLES, emojiGlyph } from '../raster/emojiArt.js';
import { FONTS } from '../raster/text.js';
import { el } from '../utils/dom.js';
import { EmojiPicker } from './EmojiPicker.js';
import { button, color, row, section, select, slider, toggle } from './kit.js';

const percent = (value) => `${Math.round(value)}%`;
const degrees = (value) => `${Math.round(value)}°`;
export const ERASER_MODES = [
  { value: 'erase', label: 'Erase drawings' },
  { value: 'layer', label: 'Erase selected layer' },
  { value: 'reveal', label: 'Reveal original' },
  { value: 'restore', label: 'Restore masks' },
];
const ERASER_HINTS = {
  erase: 'Erases drawings, or the painted area of the selected effect.',
  layer: 'Erases only the selected layer (a mask, an image, text, an effect…) and leaves everything else alone. Strength below 100% erases partly. “Clear erased area” in its properties brings it back.',
  reveal: 'Brushes through every mask and effect to show the original picture underneath.',
  restore: 'Paints the masks back over areas you revealed.',
};
export const REGION_SHAPES = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'freehand', label: 'Freehand' },
];

export function effectOptions() {
  return EFFECT_CATEGORIES.flatMap((category) =>
    EFFECTS.filter((effect) => effect.cat === category.id && !effect.hidden).map((effect) => ({ value: effect.id, label: `${category.label} · ${effect.name}` }))
  );
}

export class Inspector {
  constructor(app) {
    this.app = app;
    this.key = '';
    this.bindings = [];
    this.body = el('div', { className: 'inspector-body' });
    this.element = el('fieldset', { id: 'properties', className: 'panel-fieldset inspector-panel' }, [
      el('legend', { textContent: 'Properties' }),
      this.body,
    ]);

    const update = () => this.update();

    app.store.on('doc', update);
    app.store.on('selection', update);
    app.bus.on('tool', update);
    app.bus.on('crop-changed', update);
    app.bus.on('collage-target', update);
    this.update();
  }

  structureKey() {
    const { store } = this.app;
    const layers = store.selectedLayers;

    return [
      store.hasImage,
      this.app.toolName,
      this.app.collageCells()?.length ?? 0,
      ...layers.map((layer) => [layer.id, layer.type, layer.effectId, layer.coverage, layer.source, layer.patternId, layer.base, Boolean(layer.repeat)].join(':')),
    ].join('|');
  }

  update() {
    const key = this.structureKey();

    if (key !== this.key) {
      this.key = key;
      this.build();
      return;
    }

    for (const sync of this.bindings) {
      sync();
    }
  }

  build() {
    const { store } = this.app;
    const parts = [];

    this.bindings = [];

    if (!store.hasImage) {
      this.body.replaceChildren(
        el('div', { className: 'panel-empty-state', textContent: 'Load an image, then pick a mask from the library or grab a tool.' })
      );
      return;
    }

    const toolPart = this.toolSection();

    if (toolPart) {
      parts.push(toolPart);
    }

    const layers = store.selectedLayers;

    if (layers.length === 1) {
      const sections = this.layerSections(layers[0]);

      // The collage piece goes right under the layer's main settings.
      sections.splice(1, 0, ...this.pieceSection(layers[0]));
      parts.push(...sections, this.erasedRow(layers[0]));
    } else if (layers.length > 1) {
      parts.push(
        section(`${layers.length} layers selected`, [
          row([
            button('Duplicate', { iconName: 'duplicate', onClick: () => this.app.duplicateSelected() }),
            button('Delete', { iconName: 'trash', onClick: () => this.app.deleteSelected() }),
          ]),
        ])
      );
    } else if (!toolPart) {
      parts.push(
        el('div', { className: 'panel-empty-state', textContent: 'Nothing selected. Click a layer on the canvas or in the list to edit it.' }),
        ...this.collageTargetSection(),
        section('Picture', [this.backgroundRemovalRow(null)], { open: true })
      );
    }

    this.body.replaceChildren(...parts);
  }

  // ── collage pieces ────────────────────────────────────────────────────────

  pieceOptions(cells) {
    return [{ value: 'all', label: 'Whole collage' }, ...cells.map((_, index) => ({ value: String(index), label: `Picture ${index + 1}` }))];
  }

  /** Which collage piece the selected layer covers. */
  pieceSection(layer) {
    const app = this.app;
    const cells = app.collageCells();

    if (!cells || layer.base) {
      return [];
    }

    const read = (entry) => (entry?.clip ? String(entry.clip.piece) : 'all');
    const control = select({
      label: 'Show on',
      options: this.pieceOptions(cells),
      value: read(layer),
      onChange: (value) => app.setLayerPiece(layer.id, value === 'all' ? null : Number(value)),
    });
    const reroll = button('Random mask for this picture', {
      iconName: 'dice',
      title: 'Replace the random masks of this picture only',
      onClick: () => {
        const piece = app.store.layer(layer.id)?.clip?.piece;

        if (piece !== undefined) {
          void app.randomizeMasks({ piece });
        }
      },
    });
    const sync = () => {
      const entry = app.store.layer(layer.id);

      control.set(read(entry));
      reroll.classList.toggle('hidden', !entry?.clip);
    };

    this.bindings.push(sync);
    sync();
    return [section('Collage piece', [control.element, row([reroll], 'button-row--fill')])];
  }

  /** Nothing selected on a collage: where new masks go. */
  collageTargetSection() {
    const app = this.app;
    const cells = app.collageCells();

    if (!cells) {
      return [];
    }

    const read = () => (app.activeCollageTarget() === null ? 'all' : String(app.activeCollageTarget()));
    const control = select({
      label: 'Add masks to',
      options: this.pieceOptions(cells),
      value: read(),
      onChange: (value) => app.setCollageTarget(value === 'all' ? null : Number(value), { quiet: true }),
    });
    const random = button('Random mask', { iconName: 'dice', onClick: () => void app.randomizeMasks() });
    const label = random.querySelector('span:last-child');
    const sync = () => {
      const target = app.activeCollageTarget();

      control.set(read());
      label.textContent = target === null ? 'Random mask for every picture' : `Random mask for picture ${target + 1}`;
    };

    this.bindings.push(sync);
    sync();
    return [
      section('Collage', [
        control.element,
        row([random], 'button-row--fill'),
        el('p', { className: 'panel-intro-copy', textContent: 'Masks from the library, Random mask and its reroll go on the chosen picture. Right-click a picture for the same options; a selected layer can be moved to another picture under Collage piece.' }),
      ], { open: true }),
    ];
  }

  // ── binding helpers ───────────────────────────────────────────────────────

  /** Slider bound to the selected layer. `read(layer)` → value, `write(value, layer)` → patch. */
  layerSlider(id, options, read, write, label = 'Adjust layer') {
    const { store } = this.app;
    const control = slider({
      ...options,
      value: read(store.layer(id)),
      onInput: (value) => store.updateLayer(id, (layer) => write(value, layer)),
      onChange: () => store.end(label),
    });

    this.bindings.push(() => {
      const layer = store.layer(id);

      if (layer) {
        control.set(read(layer));
      }
    });
    return control.element;
  }

  layerColor(id, label, read, write) {
    const { store } = this.app;
    const control = color({
      label,
      value: read(store.layer(id)),
      onInput: (value) => store.updateLayer(id, (layer) => write(value, layer)),
      onChange: () => store.end('Change colour'),
    });

    this.bindings.push(() => store.layer(id) && control.set(read(store.layer(id))));
    return control.element;
  }

  layerToggle(id, label, read, write) {
    const { store } = this.app;
    const control = toggle({
      label,
      value: read(store.layer(id)),
      onChange: (value) => store.apply(label, (doc) => updateLayer(doc, id, (layer) => write(value, layer))),
    });

    this.bindings.push(() => store.layer(id) && control.set(read(store.layer(id))));
    return control.element;
  }

  layerSelect(id, label, options, read, write) {
    const { store } = this.app;
    const control = select({
      label,
      options,
      value: read(store.layer(id)),
      onChange: (value) => store.apply(label, (doc) => updateLayer(doc, id, (layer) => write(value, layer))),
    });

    this.bindings.push(() => store.layer(id) && control.set(read(store.layer(id))));
    return control.element;
  }

  /** Auto-generated controls for an effect's or pattern's parameter list. */
  paramControls(id, definition, keep = () => true) {
    const patch = (key) => (value, layer) => ({ params: { ...layer.params, [key]: value } });

    return definition.params.filter(keep).map((param) => {
      const read = (layer) => layer.params?.[param.key] ?? param.value;

      if (param.type === 'color') {
        return this.layerColor(id, param.label, read, patch(param.key));
      }

      if (param.type === 'toggle') {
        return this.layerToggle(id, param.label, read, patch(param.key));
      }

      if (param.type === 'select') {
        return this.layerSelect(
          id,
          param.label,
          param.options.map((label, index) => ({ value: index, label })),
          read,
          (value, layer) => patch(param.key)(Number(value), layer)
        );
      }

      return this.layerSlider(id, { label: param.label, min: param.min, max: param.max, step: param.step }, read, patch(param.key), `Adjust ${definition.name.toLowerCase()}`);
    });
  }

  // ── tool options ──────────────────────────────────────────────────────────

  /** Wraps a write to app.toolState so the change is announced (and remembered). */
  toolChange(write) {
    return (value) => {
      write(value);
      this.app.bus.emit('tool-settings');
    };
  }

  toolSlider(options, read, write) {
    const control = slider({
      ...options,
      value: read(),
      onInput: this.toolChange(write),
    });

    this.bindings.push(() => control.set(read()));
    return control.element;
  }

  toolSection() {
    const app = this.app;
    const state = app.toolState;
    const sizeSlider = () =>
      this.toolSlider({ label: 'Brush size', min: 1, max: 100 }, () => state.brush.size, (value) => {
        state.brush.size = value;
      });

    switch (app.toolName) {
      case 'brush':
        return section('Brush', [
          sizeSlider(),
          this.toolSlider({ label: 'Brush opacity', min: 1, max: 100, format: percent }, () => state.brush.opacity, (value) => {
            state.brush.opacity = value;
          }),
          color({ label: 'Colour', value: state.brush.color, onInput: this.toolChange((value) => { state.brush.color = value; }) }).element,
          select({ label: 'Brush type', options: BRUSH_TYPES.map((type) => ({ value: type.id, label: type.label })), value: state.brush.type, onChange: this.toolChange((value) => { state.brush.type = value; }) }).element,
        ], { className: 'tool-section--primary' });
      case 'eraser': {
        const hint = el('p', { className: 'panel-intro-copy', textContent: ERASER_HINTS[state.eraser.mode] });
        const mode = select({
          label: 'Mode',
          options: ERASER_MODES,
          value: state.eraser.mode,
          onChange: this.toolChange((value) => {
            state.eraser.mode = value;
            hint.textContent = ERASER_HINTS[value];
          }),
        });

        this.bindings.push(() => {
          mode.set(state.eraser.mode);
          hint.textContent = ERASER_HINTS[state.eraser.mode];
        });
        return section('Eraser', [
          mode.element,
          sizeSlider(),
          this.toolSlider({ label: 'Strength', min: 1, max: 100, format: percent }, () => state.brush.opacity, (value) => {
            state.brush.opacity = value;
          }),
          hint,
        ], { className: 'tool-section--primary' });
      }
      case 'blurBrush':
      case 'pixelBrush':
        return this.amountBrushSection(app.toolName === 'blurBrush' ? 'blur' : 'pixelate', sizeSlider);
      case 'paint':
        return section('Effect brush', [
          select({ label: 'Effect', options: effectOptions(), value: state.paint.effectId, onChange: this.toolChange((value) => { state.paint.effectId = value; }) }).element,
          sizeSlider(),
          this.toolSlider({ label: 'Strength', min: 1, max: 100, format: percent }, () => state.brush.opacity, (value) => {
            state.brush.opacity = value;
          }),
        ], { className: 'tool-section--primary' });
      case 'region':
        return section('Region', [
          select({ label: 'Shape', options: REGION_SHAPES, value: state.region.shape, onChange: this.toolChange((value) => { state.region.shape = value; }) }).element,
          select({ label: 'Effect', options: effectOptions(), value: state.region.effectId, onChange: this.toolChange((value) => { state.region.effectId = value; }) }).element,
        ], { className: 'tool-section--primary' });
      case 'crop':
        return this.cropSection();
      case 'stamp':
        return this.stampSection();
      case 'lasso':
        return section('Separate one item', [
          el('p', { className: 'panel-intro-copy', textContent: 'Draw a loop around the item on the picture. Only what is inside goes through the background removal, so the other things in the picture stay where they are. A rough outline is fine; leave a little room around the item.' }),
          row([button('Cancel', { iconName: 'close', onClick: () => app.setTool('select') })], 'button-row--fill'),
        ], { className: 'tool-section--primary' });
      default:
        return null;
    }
  }

  /** Blur brush / pixel brush: size, strength and the one amount slider that matters. */
  amountBrushSection(effectId, sizeSlider) {
    const app = this.app;
    const state = app.toolState;
    const amount = PAINT_AMOUNT[effectId];
    const tool = app.tools[app.toolName];
    const control = slider({
      label: amount.label,
      min: amount.min,
      max: amount.max,
      step: amount.step,
      value: state.paint.amounts[effectId],
      onInput: (value) => {
        const layer = tool.existingTarget();

        state.paint.amounts[effectId] = value;
        app.bus.emit('tool-settings');

        if (layer) {
          app.store.updateLayer(layer.id, (entry) => ({ params: { ...entry.params, [amount.key]: value } }));
        }
      },
      onChange: () => app.store.end(amount.label),
    });

    this.bindings.push(() => {
      const layer = tool.existingTarget();

      if (layer) {
        state.paint.amounts[effectId] = layer.params[amount.key];
      }

      control.set(state.paint.amounts[effectId]);
    });

    return section(effectId === 'blur' ? 'Blur brush' : 'Pixel brush', [
      sizeSlider(),
      control.element,
      this.toolSlider({ label: 'Strength', min: 1, max: 100, format: percent }, () => state.brush.opacity, (value) => {
        state.brush.opacity = value;
      }),
    ], { className: 'tool-section--primary' });
  }

  /** The shared emoji picker popover (ui/EmojiPicker.js), made on first use. */
  emojiPicker() {
    this.picker ??= new EmojiPicker(this.app);
    return this.picker;
  }

  /** Stamp tool: which emoji, how big, turned how, and what dragging does. */
  stampSection() {
    const app = this.app;
    const state = app.toolState.stamp;
    const setEmoji = (emoji) => {
      state.emoji = emoji;
      app.bus.emit('tool-settings');
      sync();
    };
    const current = el('button', { type: 'button', className: 'stamp-current', title: 'Choose the emoji to stamp', 'aria-label': 'Choose the emoji to stamp' });
    const choose = button('Choose emoji…', { iconName: 'search', className: 'app-button--fill' });
    const openPicker = (anchor) =>
      this.emojiPicker().open(anchor, { style: state.style, isActive: (emoji) => sameEmoji(emoji, state.emoji), onPick: setEmoji });
    const recent = el('div', { className: 'emoji-chips' });
    const sync = () => {
      const key = `${state.emoji}|${state.style}|${state.recent.join(' ')}`;

      if (current.dataset.value === key) {
        return;
      }

      current.dataset.value = key;
      current.replaceChildren(emojiGlyph(state.emoji, state.style));
      recent.replaceChildren(
        ...state.recent.map((emoji) => {
          const chip = el('button', { type: 'button', className: `emoji-chip${emoji === state.emoji ? ' is-active' : ''}`, title: `Stamp ${emoji}` }, [
            emojiGlyph(emoji, state.style),
          ]);

          chip.addEventListener('click', () => setEmoji(emoji));
          return chip;
        })
      );
    };
    const value = (key) => () => state[key];
    const write = (key) => (next) => {
      state[key] = next;
    };

    current.addEventListener('click', () => openPicker(current));
    choose.addEventListener('click', () => openPicker(choose));
    this.bindings.push(sync);
    sync();

    return section('Stamp', [
      el('div', { className: 'stamp-picker' }, [current, el('div', { className: 'stack' }, [choose, recent])]),
      this.toolSlider({ label: 'Stamp size', min: 2, max: 200 }, value('size'), write('size')),
      this.toolSlider({ label: 'Opacity', min: 1, max: 100, format: percent }, value('opacity'), write('opacity')),
      this.toolSlider({ label: 'Angle', min: -180, max: 180, format: degrees }, value('angle'), write('angle')),
      this.toolSlider({ label: 'Random turn', min: 0, max: 180, format: degrees }, value('spin'), write('spin')),
      select({ label: 'Dragging', options: STAMP_DRAG_MODES, value: state.drag, onChange: this.toolChange(write('drag')) }).element,
      select({
        label: 'Emoji style',
        options: EMOJI_STYLES,
        value: String(state.style),
        onChange: this.toolChange((next) => {
          state.style = Number(next);
          sync();
        }),
      }).element,
      el('p', { className: 'panel-intro-copy', textContent: 'Click to stamp. Stamps go into a drawing layer, so the eraser and undo work on them.' }),
    ], { className: 'tool-section--primary' });
  }

  cropSection() {
    const app = this.app;
    const tool = app.tools.crop;
    const width = el('input', { type: 'number', min: '16', step: '1', 'aria-label': 'Canvas width', className: 'number-input' });
    const height = el('input', { type: 'number', min: '16', step: '1', 'aria-label': 'Canvas height', className: 'number-input' });
    const sync = () => {
      if (tool.rect) {
        if (document.activeElement !== width) width.value = String(Math.round(tool.rect.width));
        if (document.activeElement !== height) height.value = String(Math.round(tool.rect.height));
      }
    };
    const commit = () => tool.setSize(Number(width.value), Number(height.value));

    width.addEventListener('change', commit);
    height.addEventListener('change', commit);
    this.bindings.push(sync);
    sync();

    return section('Crop / resize canvas', [
      el('p', { className: 'panel-intro-copy', textContent: 'Pull the frame past the edge to add empty space.' }),
      el('div', { className: 'field field--inline' }, [el('span', { className: 'field-label', textContent: 'Size' }), width, el('span', { textContent: '×' }), height]),
      row([
        button('Apply resize', { id: 'applyCropButton', onClick: () => app.applyCrop() }),
        button('Cancel resize', { id: 'cancelCropButton', onClick: () => app.setTool('select') }),
      ]),
    ], { className: 'tool-section--primary' });
  }

  // ── layer properties ──────────────────────────────────────────────────────

  commonControls(layer) {
    return [
      this.layerSlider(layer.id, { label: 'Opacity', min: 0, max: 100, format: percent }, (entry) => entry.opacity * 100, (value) => ({ opacity: value / 100 }), 'Change opacity'),
      this.layerSelect(layer.id, 'Blend mode', BLEND_MODES.map((mode) => ({ value: mode.id, label: mode.label })), (entry) => entry.blend, (value) => ({ blend: value })),
    ];
  }

  layerSections(layer) {
    switch (layer.type) {
      case 'effect':
        return this.effectSections(layer);
      case 'mask':
        return this.maskSections(layer);
      case 'text':
        return this.textSections(layer);
      case 'rect':
        return [
          section('Rectangle', [
            this.layerColor(layer.id, 'Colour', (entry) => entry.color, (value) => ({ color: value })),
            this.layerSlider(layer.id, { label: 'Corner radius', min: 0, max: 100, format: percent },
              (entry) => Math.min(100, ((entry.corner || 0) / (Math.min(entry.w, entry.h) / 2)) * 100),
              (value, entry) => ({ corner: (value / 100) * (Math.min(entry.w, entry.h) / 2) }), 'Round corners'),
            ...this.commonControls(layer),
          ]),
        ];
      case 'drawing':
        return [
          section('Drawing', [
            ...this.commonControls(layer),
            row([button('Clear drawing', { iconName: 'trash', onClick: () => this.app.store.apply('Clear drawing', (doc) => updateLayer(doc, layer.id, { strokes: [] })) })]),
          ]),
        ];
      case 'image':
        return [
          section(layer.base ? 'Base image' : 'Image', [
            ...this.commonControls(layer),
            row([
              button('Fit to canvas', { iconName: 'fit', onClick: () => this.app.fitLayerToCanvas(layer.id) }),
              ...(layer.base ? [] : [button('Use as base', { onClick: () => this.app.store.apply('Use as base', (doc) => updateLayer(doc, layer.id, { base: true })) })]),
            ]),
            this.backgroundRemovalRow(layer.id),
          ]),
        ];
      default:
        return [];
    }
  }

  /** "Clear erased area", shown while the layer has been erased with "Erase selected layer". */
  erasedRow(layer) {
    const app = this.app;
    const clear = button('Clear erased area', {
      iconName: 'eraser',
      title: 'Brings back everything erased from this layer',
      onClick: () => app.store.apply('Clear erased area', (doc) => updateLayer(doc, layer.id, { erased: null })),
    });
    const element = row([clear], 'button-row--fill');
    const sync = () => element.classList.toggle('hidden', !app.store.layer(layer.id)?.erased?.length);

    this.bindings.push(sync);
    sync();
    return element;
  }

  /**
   * "Separate background" button with live progress, and "Circle one item" to draw around the one
   * thing to separate; `layerId` null means the base picture.
   */
  backgroundRemovalRow(layerId) {
    const tools = this.app.backgroundTools;
    const control = button('Separate background', { iconName: 'sparkle', title: 'Copy the subject into its own layer above the picture, so masks can go between them (runs in your browser)', onClick: () => tools.remove(layerId) });
    const lasso = button('Circle one item', { iconName: 'pencil', title: 'Draw roughly around one item; only that item is separated', onClick: () => tools.startLasso(layerId) });
    const label = control.querySelector('span:last-child');
    const sync = () => {
      control.disabled = tools.status.busy;
      lasso.disabled = tools.status.busy;
      lasso.classList.toggle('is-active', this.app.toolName === 'lasso');
      label.textContent = tools.status.busy ? `${tools.status.label}…` : 'Separate background';
    };

    this.bindings.push(sync);
    this.app.bus.on('background-status', () => control.isConnected && sync());
    sync();
    return row([control, lasso], 'button-row--fill');
  }

  effectSections(layer) {
    const app = this.app;
    const definition = getEffect(layer.effectId);
    const region = layer.coverage === 'rect' || layer.coverage === 'ellipse' || layer.coverage === 'polygon';

    if (layer.effectId === 'original') {
      return [
        section('Revealed original', [
          this.layerSlider(layer.id, { label: 'Opacity', min: 0, max: 100, format: percent }, (entry) => entry.opacity * 100, (value) => ({ opacity: value / 100 }), 'Change opacity'),
          row([button('Clear revealed area', { iconName: 'trash', onClick: () => app.store.apply('Clear revealed area', (doc) => updateLayer(doc, layer.id, { strokes: [] })) })]),
        ], { className: 'tool-section--primary' }),
      ];
    }

    const setParams = (label, params) => app.store.apply(`${label} ${definition.name.toLowerCase()}`, (doc) => updateLayer(doc, layer.id, { params }));
    const intensity = (label, factor, title) =>
      button(label, { title, onClick: () => setParams(label, intensityParams(definition, factor, app.store.layer(layer.id).params)) });
    const ranges = definition.params.filter((param) => param.type === 'range').map((param) => param.key);
    const main = new Set(definition.main ?? ranges.slice(0, 3));
    const more = definition.params.filter((param) => !main.has(param.key));
    const settings = [
      select({ label: 'Effect', options: effectOptions(), value: layer.effectId, onChange: (value) => app.changeEffect(layer.id, value) }).element,
      this.layerSlider(layer.id, { label: 'Mix with original', min: 0, max: 100, format: percent }, (entry) => entry.opacity * 100, (value) => ({ opacity: value / 100 }), 'Change mix'),
      row([
        ...(hasIntensity(definition)
          ? [
              intensity('Gentle', INTENSITY_LEVELS.gentle, 'Easier to recognise (keeps your other settings)'),
              intensity('Strong', INTENSITY_LEVELS.strong, 'Scramble harder (keeps your other settings)'),
            ]
          : []),
        button('Reset', { iconName: 'reset', title: 'Back to the default settings', onClick: () => setParams('Reset', defaultParams(definition)) }),
        ...(definition.seeded
          ? [button('Shuffle', { iconName: 'shuffle', title: 'New random arrangement', onClick: () => app.store.apply('Shuffle', (doc) => updateLayer(doc, layer.id, { seed: Math.random() * 100 })) })]
          : []),
      ], 'button-row--fill compact-row'),
      ...this.paramControls(layer.id, definition, (param) => main.has(param.key)),
    ];

    if (more.length) {
      settings.push(section('More settings', this.paramControls(layer.id, definition, (param) => !main.has(param.key)), { open: false, className: 'tool-section--nested' }));
    }

    const area = [];

    if (definition.centered) {
      const reset = button('Reset centre', { iconName: 'reset', onClick: () => app.store.apply('Reset centre', (doc) => updateLayer(doc, layer.id, { center: null })) });

      this.bindings.push(() => {
        reset.disabled = !app.store.layer(layer.id)?.center;
      });
      reset.disabled = !layer.center;
      area.push(row([el('span', { className: 'field-label centre-hint', textContent: 'Drag the ⊕ on the picture to move the centre.' }), reset]));
    }

    if (layer.coverage === 'full') {
      area.push(row([button('Limit to a region', { iconName: 'region', onClick: () => app.setCoverage(layer.id, 'rect') })]));
    } else if (region) {
      if (layer.coverage !== 'polygon') {
        area.push(this.layerSelect(layer.id, 'Shape', REGION_SHAPES.slice(0, 2), (entry) => entry.coverage, (value) => ({ coverage: value })));
      }

      area.push(
        this.layerSlider(layer.id, { label: 'Soft edge', min: 0, max: 100, format: percent }, (entry) => entry.feather || 0, (value) => ({ feather: value }), 'Soften edge'),
        this.layerSlider(layer.id, { label: 'Magnify', min: 25, max: 400, format: percent }, (entry) => (entry.content?.magnify ?? 1) * 100, (value, entry) => ({ content: { ...entry.content, magnify: value / 100 } }), 'Magnify region'),
        this.layerSlider(layer.id, { label: 'Content rotation', min: 0, max: 360, format: degrees }, (entry) => ((entry.content?.rotation ?? 0) * 180) / Math.PI, (value, entry) => ({ content: { ...entry.content, rotation: (value * Math.PI) / 180 } }), 'Rotate region content'),
        row([
          this.layerToggle(layer.id, 'Reflect X', (entry) => entry.content?.flipX, (value, entry) => ({ content: { ...entry.content, flipX: value } })),
          this.layerToggle(layer.id, 'Reflect Y', (entry) => entry.content?.flipY, (value, entry) => ({ content: { ...entry.content, flipY: value } })),
        ]),
        row([button('Apply to whole picture', { onClick: () => app.setCoverage(layer.id, 'full') })])
      );
    } else {
      area.push(
        row([
          button('Clear painted area', { iconName: 'trash', onClick: () => app.store.apply('Clear painted area', (doc) => updateLayer(doc, layer.id, { strokes: [] })) }),
          button('Apply to whole picture', { onClick: () => app.setCoverage(layer.id, 'full') }),
        ])
      );
    }

    return [
      section(definition.name, settings, { className: 'tool-section--primary' }),
      section('Area', area),
      section('Blend', [
        this.layerSelect(layer.id, 'Blend mode', BLEND_MODES.map((mode) => ({ value: mode.id, label: mode.label })), (entry) => entry.blend, (value) => ({ blend: value })),
      ], { open: false }),
    ];
  }

  /** Emojis of an emoji mask: chips, the emoji picker, random, from the picture, sliders. */
  emojiSection(layer) {
    const app = this.app;
    const id = layer.id;
    const current = () => app.store.layer(id)?.emojis ?? [];
    const style = () => app.store.layer(id)?.params?.style ?? 0;
    const setEmojis = (emojis, label) => {
      if (!emojis.length) {
        return;
      }

      app.store.apply(label, (doc) =>
        updateLayer(doc, id, (entry) => ({ emojis, ...(/^Emoji /.test(entry.name) ? { name: emojiLayerName(emojis) } : {}) }))
      );
    };
    const has = (emoji) => current().some((entry) => sameEmoji(entry, emoji));
    const toggleEmoji = (emoji) => {
      const emojis = current();

      if (has(emoji)) {
        if (emojis.length > 1) {
          setEmojis(emojis.filter((entry) => !sameEmoji(entry, emoji)), 'Remove emoji');
        } else {
          app.notify('An emoji mask needs at least one emoji: add another one first.', 'info', 3200);
        }
      } else {
        setEmojis([...emojis, emoji].slice(0, 40), 'Add emoji');
      }
    };

    const chips = el('div', { className: 'emoji-chips' });
    const choose = button('Add or remove emojis…', { iconName: 'plus', className: 'app-button--fill' });
    const syncChips = () => {
      const emojis = current();
      const key = `${style()}|${emojis.join(' ')}`;

      if (chips.dataset.value === key) {
        return;
      }

      chips.dataset.value = key;
      chips.replaceChildren(
        ...emojis.map((emoji) => {
          const chip = el('button', { type: 'button', className: 'emoji-chip', title: emojis.length > 1 ? `Remove ${emoji}` : 'An emoji mask needs at least one emoji' }, [
            emojiGlyph(emoji, style()),
          ]);

          chip.addEventListener('click', () => toggleEmoji(emoji));
          return chip;
        })
      );
    };

    choose.addEventListener('click', () =>
      this.emojiPicker().open(choose, {
        style: style(),
        multiple: true,
        isActive: has,
        onPick: toggleEmoji,
        hint: 'Click emojis to add them to the mask, or click a highlighted one to take it out.',
      })
    );

    const fromPicture = button('From the picture', {
      iconName: 'sparkle',
      title: 'Picks emojis for what the picture shows with a small model in your browser (about 23 MB the first time). They can hint at the answer.',
      onClick: () => app.emojiTools.applyToLayer(id),
    });
    const fromPictureLabel = fromPicture.querySelector('span:last-child');
    const syncStatus = () => {
      const status = app.emojiTools.status;

      fromPicture.disabled = status.busy;
      fromPictureLabel.textContent = status.busy ? `${status.label}…` : 'From the picture';
    };

    app.bus.on('emoji-status', () => fromPicture.isConnected && syncStatus());

    this.bindings.push(syncChips, syncStatus);
    syncChips();
    syncStatus();

    return section('Emojis', [
      chips,
      row([choose], 'button-row--fill'),
      row([
        button('Random', { iconName: 'dice', title: 'A random set of emojis', onClick: () => setEmojis(randomEmojis(), 'Random emojis') }),
        fromPicture,
        button('Shuffle', { iconName: 'shuffle', title: 'Same emojis, new arrangement', onClick: () => app.store.apply('Shuffle', (doc) => updateLayer(doc, id, { seed: Math.random() * 100 })) }),
      ]),
      ...this.paramControls(id, EMOJI_MASK),
    ], { className: 'tool-section--primary' });
  }

  maskSections(layer) {
    const app = this.app;
    const id = layer.id;
    const parts = [];

    if (layer.source === 'pattern') {
      const definition = getPattern(layer.patternId);
      const controls = this.paramControls(id, definition);

      if (definition.seeded) {
        controls.push(row([button('Shuffle', { iconName: 'shuffle', onClick: () => app.store.apply('Shuffle', (doc) => updateLayer(doc, id, { seed: Math.random() * 100 })) })]));
      }

      parts.push(section(`${definition.name} pattern`, controls, { className: 'tool-section--primary' }));
    }

    if (layer.source === 'emoji') {
      parts.push(this.emojiSection(layer));
    }

    if (layer.source === 'asset' && layer.repeat) {
      const repeatSlider = (key, label, min, max) =>
        this.layerSlider(id, { label, min, max }, (entry) => entry.repeat?.[key] ?? REPEAT_DEFAULTS[key], (value, entry) => ({ repeat: { ...REPEAT_DEFAULTS, ...entry.repeat, [key]: value } }), 'Adjust repeat');

      parts.push(section('Repeat as a pattern', [
        el('p', { className: 'panel-intro-copy', textContent: 'The image is drawn small, many times, in staggered rows, like the flag masks. Density sets how far apart the copies are; Mask zoom makes everything bigger.' }),
        repeatSlider('rows', 'Density', 1, 40),
        repeatSlider('size', 'Image size', 10, 300),
        repeatSlider('stagger', 'Row offset', 0, 100),
        repeatSlider('wobble', 'Wobble each', 0, 100),
        repeatSlider('warp', 'Warp each', 0, 100),
        row([
          button('Shuffle', {
            iconName: 'shuffle',
            title: 'New wobble and warp for every copy',
            onClick: () => app.store.apply('Shuffle', (doc) => updateLayer(doc, id, (entry) => ({ repeat: { ...REPEAT_DEFAULTS, ...entry.repeat, seed: Math.random() * 100 } }))),
          }),
        ]),
      ], { className: 'tool-section--primary' }));
    }

    parts.push(
      section('Mask & blend', [
        this.layerSlider(id, { label: 'Mask opacity', min: 0, max: 100, format: percent }, (entry) => entry.opacity * 100, (value) => ({ opacity: value / 100 }), 'Mask opacity'),
        this.layerSlider(id, { label: 'Mask zoom', min: 0, max: 100 }, (entry) => entry.zoom ?? 50, (value, entry) => ({ zoom: value, w: entry.natW * zoomFactor(value), h: entry.natH * zoomFactor(value) }), 'Mask zoom'),
        this.layerSlider(id, { label: 'Mask angle', min: -180, max: 180, format: degrees }, (entry) => ((((entry.rotation * 180) / Math.PI + 180) % 360) + 360) % 360 - 180, (value) => ({ rotation: (value * Math.PI) / 180 }), 'Mask angle'),
        this.layerSelect(id, 'Blend mode', BLEND_MODES.map((mode) => ({ value: mode.id, label: mode.label })), (entry) => entry.blend, (value) => ({ blend: value })),
        ...(layer.source === 'asset'
          ? [row([
              this.layerToggle(id, 'Repeat as a pattern', (entry) => Boolean(entry.repeat), (value) => ({ repeat: value ? { ...REPEAT_DEFAULTS } : null })),
              ...(layer.repeat ? [] : [this.layerToggle(id, 'Tile to fill', (entry) => entry.tile, (value) => ({ tile: value }))]),
            ])]
          : []),
      ], { className: layer.source === 'asset' ? 'tool-section--primary' : '' }),
      section('Mask effects', [
        this.layerSlider(id, { label: 'Hue', min: 0, max: 360, format: degrees }, (entry) => entry.hue || 0, (value) => ({ hue: value }), 'Mask hue'),
        this.layerSlider(id, { label: 'Blur', min: 0, max: 100 }, (entry) => entry.blur || 0, (value) => ({ blur: value }), 'Mask blur'),
        this.layerSlider(id, { label: 'Noise', min: 0, max: 100 }, (entry) => entry.noise || 0, (value) => ({ noise: value }), 'Mask noise'),
        this.layerSlider(id, { label: 'Warp', min: 0, max: 100 }, (entry) => entry.warp || 0, (value) => ({ warp: value }), 'Mask warp'),
        row([
          this.layerToggle(id, 'Invert', (entry) => entry.invert, (value) => ({ invert: value })),
          button('Reseed warp', { iconName: 'shuffle', onClick: () => app.store.apply('Reseed warp', (doc) => updateLayer(doc, id, (entry) => ({ warpSeed: Math.random(), warp: entry.warp || 30 }))) }),
          button('Re-tilt', { title: 'New random tilt and skew', onClick: () => app.retiltMask(id) }),
        ]),
      ], { open: false })
    );

    return parts;
  }

  textSections(layer) {
    const app = this.app;
    const id = layer.id;
    const doc = app.store.doc;
    const style = (key) => (value, entry) => {
      app.toolState.text[key] = value;
      app.bus.emit('tool-settings');
      return fitText({ ...entry, [key]: value });
    };
    const textInput = el('textarea', { rows: '3', 'aria-label': 'Text', className: 'text-input' });

    textInput.value = layer.text;
    textInput.addEventListener('input', () => app.store.updateLayer(id, (entry) => fitText({ ...entry, text: textInput.value })));
    textInput.addEventListener('change', () => app.store.end('Edit text'));
    this.bindings.push(() => {
      const entry = app.store.layer(id);

      if (entry && document.activeElement !== textInput && textInput.value !== entry.text) {
        textInput.value = entry.text;
      }
    });

    return [
      section('Text', [
        textInput,
        this.layerSelect(id, 'Font', FONTS.map((font) => ({ value: font, label: font })), (entry) => entry.font, style('font')),
        this.layerSlider(id, { label: 'Text size', min: 8, max: Math.max(64, Math.round(Math.min(doc.width, doc.height) * 0.6)) }, (entry) => entry.size, style('size'), 'Text size'),
        this.layerColor(id, 'Colour', (entry) => entry.color, style('color')),
        this.layerSelect(id, 'Alignment', [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }], (entry) => entry.align, style('align')),
        row([
          this.layerToggle(id, 'Bold', (entry) => entry.bold, style('bold')),
          this.layerToggle(id, 'Italic', (entry) => entry.italic, style('italic')),
        ]),
      ], { className: 'tool-section--primary' }),
      section('Outline & shadow', [
        this.layerColor(id, 'Outline colour', (entry) => entry.outlineColor, style('outlineColor')),
        this.layerSlider(id, { label: 'Outline width', min: 0, max: 30 }, (entry) => entry.outlineWidth, style('outlineWidth'), 'Outline width'),
        row([this.layerToggle(id, 'Shadow', (entry) => entry.shadow, style('shadow'))]),
        this.layerColor(id, 'Shadow colour', (entry) => entry.shadowColor, style('shadowColor')),
        this.layerSlider(id, { label: 'Shadow blur', min: 0, max: 60 }, (entry) => entry.shadowBlur, style('shadowBlur'), 'Shadow blur'),
        this.layerSlider(id, { label: 'Shadow distance', min: 0, max: 60 }, (entry) => entry.shadowDistance, style('shadowDistance'), 'Shadow distance'),
      ]),
      section('Blend', this.commonControls(layer)),
    ];
  }
}
