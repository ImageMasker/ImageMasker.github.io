import { el } from '../utils/dom.js';

const ICONS = {
  select: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 2.5v13l3.7-3.1 2.4 5.1 2.2-1-2.4-5.1 4.9-.3L4 2.5Z" />
    </svg>
  `,
  hide: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4C4.9 4 1.7 9.1 1.6 9.3a1.2 1.2 0 0 0 0 1.4C1.7 10.9 4.9 16 10 16s8.3-5.1 8.4-5.3a1.2 1.2 0 0 0 0-1.4C18.3 9.1 15.1 4 10 4Zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
    </svg>
  `,
  show: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.2 3.6 16.4 17.8l1.4-1.4-2.1-2.1c1.7-1.2 2.7-2.7 2.7-2.8a1.2 1.2 0 0 0 0-1.4C18.3 9.9 15.1 4.8 10 4.8c-1.4 0-2.7.4-3.8 1L3.6 2.2 2.2 3.6Zm7.8 3.2a3 3 0 0 1 2.9 3.6l-3.5-3.5c.2-.1.4-.1.6-.1Zm-6 3a14.3 14.3 0 0 0 2.6 2.6L5 11a3 3 0 0 1-.2-1Zm6 3a3 3 0 0 1-2.9-3.6l3.5 3.5c-.2.1-.4.1-.6.1Z" />
    </svg>
  `,
  lock: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 8V6.5a4 4 0 1 1 8 0V8h.5A1.5 1.5 0 0 1 16 9.5v6A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5v-6A1.5 1.5 0 0 1 5.5 8H6Zm2 0h4V6.5a2 2 0 1 0-4 0V8Z" />
    </svg>
  `,
  unlock: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M14.5 8H8V6.5a2 2 0 1 1 4 0V7h2v-.5a4 4 0 1 0-8 0V8h-.5A1.5 1.5 0 0 0 4 9.5v6A1.5 1.5 0 0 0 5.5 17h9A1.5 1.5 0 0 0 16 15.5v-6A1.5 1.5 0 0 0 14.5 8Z" />
    </svg>
  `,
  up: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4.6 4.3 10.3l1.4 1.4 3.3-3.3V16h2V8.4l3.3 3.3 1.4-1.4L10 4.6Z" />
    </svg>
  `,
  down: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9 4v7.6L5.7 8.3l-1.4 1.4L10 15.4l5.7-5.7-1.4-1.4-3.3 3.3V4H9Z" />
    </svg>
  `,
  delete: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 3h6l1 2h3v2H3V5h3l1-2Zm-1 5h2v7H6V8Zm6 0h2v7h-2V8ZM9 8h2v7H9V8Z" />
    </svg>
  `,
  expand: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6.2 7.3 3.8 4 3.8-4 1.4 1.4-5.2 5.4-5.2-5.4 1.4-1.4Z" />
    </svg>
  `,
  collapse: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m6.2 12.7 3.8-4 3.8 4 1.4-1.4-5.2-5.4-5.2 5.4 1.4 1.4Z" />
    </svg>
  `,
};

export class LayerPanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.emptyState = el('div', {
      className: 'panel-empty-state',
      textContent: 'No editable layers yet. Add a mask, text, shape, or region effect to manage layers here.',
    });
    this.refs.list = el('div', { className: 'layer-list' });

    this.refs.root = el('fieldset', { id: 'layerPanel', className: 'panel-fieldset' }, [
      el('legend', { textContent: 'Layers' }),
      this.refs.emptyState,
      this.refs.list,
    ]);

    return this.refs.root;
  }

  renderLayers(layers, selectionState = {}) {
    const orderedLayers = layers.slice().reverse();
    const selectedLayerIds = new Set(selectionState.selectedLayerIds ?? []);
    const activeLayerId = selectionState.activeLayerId ?? null;
    this.refs.emptyState.classList.toggle('hidden', orderedLayers.length > 0);

    this.refs.list.replaceChildren(
      ...orderedLayers.map((layer) => this.createRow(layer, {
        isSelected: selectedLayerIds.has(layer.id),
        isActive: activeLayerId === layer.id,
      }))
    );
  }

  createRow(layer, selectionState = {}) {
    const visibilityToggleable = layer.visibilityToggleable !== false;
    const lockToggleable = layer.lockToggleable !== false;
    const reorderable = layer.reorderable !== false;
    const deletable = layer.deletable !== false;
    const settings = layer.settings ?? null;
    const actionButtons = [];

    if (visibilityToggleable) {
      actionButtons.push(this.createIconButton({
        layer,
        action: 'toggle-visibility',
        icon: layer.visible ? 'hide' : 'show',
        label: layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`,
        active: layer.visible === false,
      }));
    }

    if (lockToggleable) {
      actionButtons.push(this.createIconButton({
        layer,
        action: 'toggle-lock',
        icon: layer.locked ? 'unlock' : 'lock',
        label: layer.locked ? `Unlock layer ${layer.name}` : `Lock layer ${layer.name}`,
        active: layer.locked === true,
      }));
    }

    if (reorderable) {
      actionButtons.push(this.createIconButton({
        layer,
        action: 'move-up',
        icon: 'up',
        label: `Move layer ${layer.name} up`,
      }));
      actionButtons.push(this.createIconButton({
        layer,
        action: 'move-down',
        icon: 'down',
        label: `Move layer ${layer.name} down`,
      }));
    }

    if (settings?.available) {
      actionButtons.push(this.createIconButton({
        layer,
        action: 'toggle-settings',
        icon: settings.expanded ? 'collapse' : 'expand',
        label: settings.expanded
          ? `Hide settings for layer ${layer.name}`
          : `Show settings for layer ${layer.name}`,
        active: settings.expanded === true,
      }));
    }

    if (deletable) {
      actionButtons.push(this.createIconButton({
        layer,
        action: 'delete',
        icon: 'delete',
        label: `Delete layer ${layer.name}`,
      }));
    }

    return el('div', {
      className: [
        'layer-row',
        selectionState.isSelected ? 'is-selected' : '',
        selectionState.isActive ? 'is-active' : '',
      ].filter(Boolean).join(' '),
      'data-layer-id': layer.id,
      tabindex: '0',
      role: 'button',
      'aria-pressed': selectionState.isSelected ? 'true' : 'false',
    }, [
      this.createPreview(layer),
      el('div', { className: 'layer-row-content' }, [
        el('div', { className: 'layer-row-header' }, [
          el('div', { className: 'layer-row-main' }, [
            el('div', {
              className: 'layer-row-title',
              textContent: layer.name,
              title: layer.name,
            }),
          ]),
          el('div', { className: 'layer-row-actions' }, actionButtons),
        ]),
        this.createOpacityControl(layer),
        settings?.expanded ? this.createSettingsPanel(layer, settings) : null,
      ]),
    ]);
  }

  createOpacityControl(layer) {
    const opacityPercent = Math.round((layer.opacity ?? 1) * 100);

    return el('div', { className: 'layer-opacity-control' }, [
      el('div', { className: 'layer-opacity-header' }, [
        el('span', { className: 'layer-opacity-label', textContent: 'Layer opacity' }),
        el('span', {
          className: 'layer-opacity-value',
          textContent: `${opacityPercent}%`,
        }),
      ]),
      el('input', {
        type: 'range',
        min: '0',
        max: '100',
        value: String(opacityPercent),
        className: 'sliders layer-opacity-slider',
        'data-layer-id': layer.id,
        'aria-label': `Opacity for layer ${layer.name}`,
      }),
    ]);
  }

  createSettingsPanel(layer, settings) {
    const sections = [];

    if (settings.mask) {
      sections.push(
        this.createSettingField({
          label: 'Mask opacity',
          value: `${settings.mask.opacity}%`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'opacity',
              value: settings.mask.opacity,
              min: 0,
              max: 100,
              valueLabel: `${settings.mask.opacity}%`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Mask zoom',
          value: `${settings.mask.zoom}`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'zoom',
              value: settings.mask.zoom,
              min: 0,
              max: 100,
              valueLabel: `${settings.mask.zoom}`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Mask angle',
          value: `${settings.mask.angle}deg`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'angle',
              value: settings.mask.angle,
              min: 0,
              max: 360,
              valueLabel: `${settings.mask.angle}deg`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Hue',
          value: `${settings.mask.hue}`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'hue',
              value: settings.mask.hue,
              min: 0,
              max: 2,
              step: 0.002,
              valueLabel: `${settings.mask.hue}`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Invert',
          controls: [
            this.createTextButton({
              layer,
              action: 'toggle-mask-invert',
              label: 'Invert',
              active: settings.mask.invert === true,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Blur',
          value: `${settings.mask.blur}`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'blur',
              value: settings.mask.blur,
              min: 0,
              max: 20,
              valueLabel: `${settings.mask.blur}`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Noise',
          value: `${settings.mask.noise}%`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'noise',
              value: settings.mask.noise,
              min: 0,
              max: 100,
              valueLabel: `${settings.mask.noise}%`,
            }),
          ],
        }),
        this.createSettingField({
          label: 'Warp',
          value: `${settings.mask.displacement}`,
          controls: [
            this.createMaskSlider({
              layer,
              setting: 'displacement',
              value: settings.mask.displacement,
              min: 0,
              max: 60,
              valueLabel: `${settings.mask.displacement}`,
            }),
            this.createTextButton({
              layer,
              action: 'reseed-mask-displacement',
              label: 'Reseed',
            }),
          ],
        }),
      );
    }

    return el('div', { className: 'layer-settings-panel' }, sections);
  }

  createSettingField({ label, value = '', controls = [] }) {
    return el('div', { className: 'layer-setting-field' }, [
      el('div', { className: 'layer-setting-header' }, [
        el('span', { className: 'layer-setting-label', textContent: label }),
        value
          ? el('span', { className: 'layer-setting-value', textContent: value })
          : null,
      ]),
      el('div', { className: 'layer-setting-controls' }, controls),
    ]);
  }

  createMaskSlider({
    layer,
    setting,
    value,
    min,
    max,
    step = null,
    valueLabel,
  }) {
    return el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      value: String(value),
      ...(step !== null ? { step: String(step) } : {}),
      className: 'sliders layer-mask-slider',
      'data-layer-id': layer.id,
      'data-layer-setting': setting,
      'data-setting-value': valueLabel,
      'aria-label': `${setting} for layer ${layer.name}`,
    });
  }

  createTextButton({ layer, action, label, active = false }) {
    return el('button', {
      type: 'button',
      className: `app-button layer-setting-button ${active ? 'is-active' : ''}`.trim(),
      textContent: label,
      'data-layer-action': action,
      'data-layer-id': layer.id,
      'aria-label': `${label} for layer ${layer.name}`,
    });
  }

  createPreview(layer) {
    const preview = layer.preview ?? {};
    const body = el('div', {
      className: `layer-preview-body ${preview.kind ? `is-${preview.kind}` : 'is-placeholder'}`.trim(),
      title: preview.label ?? layer.name,
      'aria-label': preview.label ?? layer.name,
    });

    if (preview.src) {
      body.style.backgroundImage = `url("${preview.src}")`;
    }

    if (preview.kind === 'text') {
      body.textContent = preview.text ?? 'T';
      body.style.color = preview.color ?? '#111111';
    }

    if (preview.kind === 'shape') {
      const swatch = el('span', { className: 'layer-preview-shape' });
      swatch.style.background = preview.color ?? '#7a7a7a';
      swatch.style.opacity = String(preview.alpha ?? 1);
      body.appendChild(swatch);
    }

    if (!preview.src && preview.kind !== 'text' && preview.kind !== 'shape') {
      body.textContent = preview.badge ?? 'LAY';
    }

    return el('div', {
      className: 'layer-preview',
      title: preview.label ?? layer.name,
    }, [
      body,
      el('span', {
        className: 'layer-preview-badge',
        textContent: preview.badge ?? 'LAY',
      }),
    ]);
  }

  createIconButton({ layer, action, icon, label, active = false }) {
    return el('button', {
      type: 'button',
      className: `app-button layer-icon-button ${active ? 'is-active' : ''}`.trim(),
      innerHTML: ICONS[icon] ?? '',
      title: label,
      'data-layer-action': action,
      'data-layer-id': layer.id,
      'aria-label': label,
    });
  }
}
