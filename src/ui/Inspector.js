// Properties panel: options for the active tool and for the selected layer(s). The controls are
// rebuilt only when the kind of thing being edited changes; otherwise their values are synced.

import { fitText, updateLayer, zoomFactor } from '../core/model.js';
import { EFFECT_CATEGORIES, EFFECTS, getEffect } from '../gl/effects.js';
import { BLEND_MODES } from '../gl/glsl.js';
import { getPattern } from '../gl/patterns.js';
import { BRUSH_TYPES } from '../raster/strokes.js';
import { FONTS } from '../raster/text.js';
import { el } from '../utils/dom.js';
import { button, color, row, section, select, slider, toggle } from './kit.js';

const percent = (value) => `${Math.round(value)}%`;
const degrees = (value) => `${Math.round(value)}°`;
const REGION_SHAPES = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'freehand', label: 'Freehand' },
];

export function effectOptions() {
  return EFFECT_CATEGORIES.flatMap((category) =>
    EFFECTS.filter((effect) => effect.cat === category.id).map((effect) => ({ value: effect.id, label: `${category.label} · ${effect.name}` }))
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
    this.update();
  }

  structureKey() {
    const { store } = this.app;
    const layers = store.selectedLayers;

    return [
      store.hasImage,
      this.app.toolName,
      ...layers.map((layer) => [layer.id, layer.type, layer.effectId, layer.coverage, layer.source, layer.patternId, layer.base].join(':')),
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
      parts.push(...this.layerSections(layers[0]));
    } else if (layers.length > 1) {
      parts.push(
        section(`${layers.length} layers selected`, [
          el('p', { className: 'panel-intro-copy', textContent: 'Drag to move them together. Arrow keys nudge (with Shift) or change opacity.' }),
          row([
            button('Duplicate', { iconName: 'duplicate', onClick: () => this.app.duplicateSelected() }),
            button('Delete', { iconName: 'trash', onClick: () => this.app.deleteSelected() }),
          ]),
        ])
      );
    } else if (!toolPart) {
      parts.push(
        el('div', { className: 'panel-empty-state', textContent: 'Nothing selected. Click a layer on the canvas or in the list to edit it.' })
      );
    }

    this.body.replaceChildren(...parts);
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
  paramControls(id, definition) {
    const patch = (key) => (value, layer) => ({ params: { ...layer.params, [key]: value } });

    return definition.params.map((param) => {
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

  toolSlider(options, read, write) {
    const control = slider({
      ...options,
      value: read(),
      onInput: (value) => {
        write(value);
        this.app.bus.emit('tool-settings');
      },
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
          color({ label: 'Colour', value: state.brush.color, onInput: (value) => { state.brush.color = value; } }).element,
          select({ label: 'Brush type', options: BRUSH_TYPES.map((type) => ({ value: type.id, label: type.label })), value: state.brush.type, onChange: (value) => { state.brush.type = value; } }).element,
        ], { className: 'tool-section--primary' });
      case 'eraser':
        return section('Eraser', [
          sizeSlider(),
          el('p', { className: 'panel-intro-copy', textContent: 'Erases drawings, or the painted area of the selected effect.' }),
        ], { className: 'tool-section--primary' });
      case 'paint':
        return section('Effect brush', [
          select({ label: 'Effect', options: effectOptions(), value: state.paint.effectId, onChange: (value) => { state.paint.effectId = value; } }).element,
          sizeSlider(),
          this.toolSlider({ label: 'Strength', min: 1, max: 100, format: percent }, () => state.brush.opacity, (value) => {
            state.brush.opacity = value;
          }),
          el('p', { className: 'panel-intro-copy', textContent: 'Paint where the effect should show. Keep the painted layer selected to add more to it.' }),
        ], { className: 'tool-section--primary' });
      case 'region':
        return section('Region', [
          select({ label: 'Shape', options: REGION_SHAPES, value: state.region.shape, onChange: (value) => { state.region.shape = value; } }).element,
          select({ label: 'Effect', options: effectOptions(), value: state.region.effectId, onChange: (value) => { state.region.effectId = value; } }).element,
          el('p', { className: 'panel-intro-copy', textContent: 'Drag on the picture to mark the area. Hold Shift for a square or circle.' }),
        ], { className: 'tool-section--primary' });
      case 'crop':
        return this.cropSection();
      default:
        return null;
    }
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
      el('p', { className: 'panel-intro-copy', textContent: 'Drag the frame. Pull it past the edge to add empty space around the picture.' }),
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
          ]),
        ];
      default:
        return [];
    }
  }

  effectSections(layer) {
    const app = this.app;
    const definition = getEffect(layer.effectId);
    const region = layer.coverage === 'rect' || layer.coverage === 'ellipse' || layer.coverage === 'polygon';
    const settings = [
      select({ label: 'Effect', options: effectOptions(), value: layer.effectId, onChange: (value) => app.changeEffect(layer.id, value) }).element,
      ...this.paramControls(layer.id, definition),
    ];

    if (definition.seeded) {
      settings.push(row([
        button('Shuffle', { iconName: 'shuffle', title: 'New random arrangement', onClick: () => app.store.apply('Shuffle', (doc) => updateLayer(doc, layer.id, { seed: Math.random() * 100 })) }),
        button('Reset', { iconName: 'reset', onClick: () => app.changeEffect(layer.id, layer.effectId) }),
      ]));
    } else {
      settings.push(row([button('Reset', { iconName: 'reset', onClick: () => app.changeEffect(layer.id, layer.effectId) })]));
    }

    const area = [];

    if (layer.coverage === 'full') {
      area.push(
        el('p', { className: 'panel-intro-copy', textContent: 'Covers the whole picture.' }),
        row([button('Limit to a region', { iconName: 'region', onClick: () => app.setCoverage(layer.id, 'rect') })])
      );
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
        el('p', { className: 'panel-intro-copy', textContent: 'Painted on. Use the effect brush to add and the eraser to remove.' }),
        row([
          button('Clear painted area', { iconName: 'trash', onClick: () => app.store.apply('Clear painted area', (doc) => updateLayer(doc, layer.id, { strokes: [] })) }),
          button('Apply to whole picture', { onClick: () => app.setCoverage(layer.id, 'full') }),
        ])
      );
    }

    return [
      section(definition.name, settings, { className: 'tool-section--primary' }),
      section('Area', area),
      section('Blend', this.commonControls(layer)),
    ];
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

    parts.push(
      section('Mask & blend', [
        this.layerSlider(id, { label: 'Mask opacity', min: 0, max: 100, format: percent }, (entry) => entry.opacity * 100, (value) => ({ opacity: value / 100 }), 'Mask opacity'),
        this.layerSlider(id, { label: 'Mask zoom', min: 0, max: 100 }, (entry) => entry.zoom ?? 50, (value, entry) => ({ zoom: value, w: entry.natW * zoomFactor(value), h: entry.natH * zoomFactor(value) }), 'Mask zoom'),
        this.layerSlider(id, { label: 'Mask angle', min: -180, max: 180, format: degrees }, (entry) => ((((entry.rotation * 180) / Math.PI + 180) % 360) + 360) % 360 - 180, (value) => ({ rotation: (value * Math.PI) / 180 }), 'Mask angle'),
        this.layerSelect(id, 'Blend mode', BLEND_MODES.map((mode) => ({ value: mode.id, label: mode.label })), (entry) => entry.blend, (value) => ({ blend: value })),
        ...(layer.source === 'asset' ? [row([this.layerToggle(id, 'Tile to fill', (entry) => entry.tile, (value) => ({ tile: value }))])] : []),
      ], { className: layer.source === 'pattern' ? '' : 'tool-section--primary' }),
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
      ])
    );

    return parts;
  }

  textSections(layer) {
    const app = this.app;
    const id = layer.id;
    const doc = app.store.doc;
    const style = (key) => (value, entry) => {
      app.toolState.text[key] = value;
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
