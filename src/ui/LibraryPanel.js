// The mask library: effect masks, overlay masks (procedural + classic images), flags and the
// user's own mask URLs. Thumbnails are rendered live from the loaded picture.

import { EFFECT_CATEGORIES, EFFECTS, defaultParams } from '../gl/effects.js';
import { PATTERNS } from '../gl/patterns.js';
import { PRESET_MASKS } from '../masks/maskData.js';
import { el } from '../utils/dom.js';
import { createSampleScene } from '../utils/sampleScene.js';
import { button, icon, message } from './kit.js';

const TABS = [
  { id: 'effects', label: 'Effects' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'flags', label: 'Flags' },
  { id: 'custom', label: 'Custom' },
];
const THUMB_WIDTH = 176;
const STRENGTH_LABEL = ['', 'Light scramble', 'Medium scramble', 'Heavy scramble'];

export class LibraryPanel {
  constructor(app) {
    this.app = app;
    this.tab = 'effects';
    this.thumbs = [];
    this.thumbTimer = 0;
    this.thumbJob = 0;
    this.flagsLoaded = false;
    this.panels = {};
    this.tabButtons = {};
    this.element = this.render();
    this.setTab('effects');

    app.bus.on('image-changed', () => this.scheduleThumbs(250));
  }

  render() {
    const tabs = el(
      'div',
      { className: 'tab-strip', role: 'tablist' },
      TABS.map((tab) => {
        const tabButton = el('button', { type: 'button', className: 'tab-button', textContent: tab.label, role: 'tab' });

        tabButton.addEventListener('click', () => this.setTab(tab.id));
        this.tabButtons[tab.id] = tabButton;
        return tabButton;
      })
    );

    this.panels.effects = this.renderEffects();
    this.panels.overlays = this.renderOverlays();
    this.panels.flags = this.renderFlags();
    this.panels.custom = this.renderCustom();

    return el('fieldset', { id: 'masks', className: 'panel-fieldset library-panel' }, [
      el('legend', { textContent: 'Masks' }),
      tabs,
      el('div', { className: 'library-scroll' }, Object.values(this.panels)),
    ]);
  }

  setTab(id) {
    this.tab = id;

    for (const tab of TABS) {
      this.tabButtons[tab.id].classList.toggle('is-active', tab.id === id);
      this.tabButtons[tab.id].setAttribute('aria-selected', tab.id === id ? 'true' : 'false');
      this.panels[tab.id].classList.toggle('hidden', tab.id !== id);
    }

    if (id === 'flags') {
      this.loadFlags();
    }
  }

  /** A gallery tile. `render(source)` returns ImageData for live thumbnails. */
  tile({ label, title = '', strength = 0, image = '', render = null, onPick }) {
    const preview = render
      ? el('canvas', { className: 'mask-tile-preview', width: '8', height: '8' })
      : el('img', { className: 'mask-tile-preview', src: image, alt: '', loading: 'lazy' });
    const add = el('span', { className: 'mask-tile-add', title: 'Add as a new layer', role: 'button', 'aria-label': `Stack ${label}` }, [icon('plus')]);
    const tileButton = el('button', { type: 'button', className: 'mask-tile', title: `${title || label}\nClick to try it (replaces the selected mask), Shift+click or + to stack.` }, [
      preview,
      el('span', { className: 'mask-tile-label' }, [
        el('span', { className: 'mask-tile-name', textContent: label }),
        ...(strength
          ? [el('span', { className: `mask-tile-strength strength-${strength}`, title: STRENGTH_LABEL[strength], 'aria-label': STRENGTH_LABEL[strength] })]
          : []),
      ]),
      add,
    ]);

    tileButton.addEventListener('click', (event) => {
      onPick({ stack: event.shiftKey || add.contains(event.target) });
    });

    if (render) {
      this.thumbs.push({ canvas: preview, render });
    }

    return tileButton;
  }

  renderEffects() {
    const groups = EFFECT_CATEGORIES.map((category) =>
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: category.label }),
        el(
          'div',
          { className: 'mask-grid' },
          EFFECTS.filter((effect) => effect.cat === category.id && !effect.hidden).map((effect) =>
            this.tile({
              label: effect.name,
              title: effect.desc,
              strength: effect.strength,
              render: (source) =>
                this.app.stage.compositor.effectPreview(effect, { ...defaultParams(effect), ...(effect.thumb ?? {}) }, 12.5, source),
              onPick: (options) => this.app.addEffect(effect.id, options),
            })
          )
        ),
      ])
    );

    return el('div', { className: 'library-tab' }, [
      ...groups,
    ]);
  }

  renderOverlays() {
    return el('div', { className: 'library-tab hidden' }, [
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Classic' }),
        el(
          'div',
          { className: 'mask-grid' },
          PRESET_MASKS.map((preset) =>
            this.tile({
              label: preset.name,
              image: preset.thumb,
              onPick: (options) => this.app.addPresetMask(preset, options),
            })
          )
        ),
      ]),
      el('section', { className: 'library-group' }, [
        el('h3', { className: 'library-group-title', textContent: 'Patterns' }),
        el(
          'div',
          { className: 'mask-grid' },
          PATTERNS.map((pattern) =>
            this.tile({
              label: pattern.name,
              render: (source) => this.app.stage.compositor.patternPreview(pattern, defaultParams(pattern), 12.5, source),
              onPick: (options) => this.app.addPattern(pattern.id, options),
            })
          )
        ),
      ]),
    ]);
  }

  renderFlags() {
    this.flagSearch = el('input', { type: 'search', placeholder: 'Search flags…', 'aria-label': 'Search flag masks', className: 'library-search' });
    this.flagGrid = el('div', { className: 'mask-grid mask-grid--flags' });
    this.flagStatus = el('div', { className: 'panel-empty-state', textContent: 'Loading flags…' });
    this.flagSearch.addEventListener('input', () => this.renderFlagGrid());

    return el('div', { className: 'library-tab hidden' }, [this.flagSearch, this.flagStatus, this.flagGrid]);
  }

  async loadFlags() {
    if (this.flagsLoaded) {
      return;
    }

    this.flagsLoaded = true;

    try {
      this.flags = (await this.app.flagCatalog()).flags;
      this.renderFlagGrid();
    } catch (error) {
      this.flagsLoaded = false;
      this.flagStatus.textContent = 'Could not load the flag masks.';
    }
  }

  renderFlagGrid() {
    const query = this.flagSearch.value.trim().toLowerCase();
    const flags = (this.flags ?? []).filter((flag) => flag.name.toLowerCase().includes(query));

    this.flagStatus.classList.toggle('hidden', flags.length > 0);
    this.flagStatus.textContent = 'No flags found.';
    this.flagGrid.replaceChildren(
      ...flags.map((flag) =>
        this.tile({
          label: flag.name,
          image: flag.motif?.src || flag.full?.src || '',
          onPick: (options) => this.app.addFlagMask(flag, options),
        })
      )
    );
  }

  renderCustom() {
    this.customGrid = el('div', { className: 'mask-grid' });
    this.customEmpty = el('div', { className: 'panel-empty-state', textContent: 'No custom masks saved yet.' });
    this.customInput = el('input', { id: 'customMaskURL', type: 'url', placeholder: 'Mask URL (Imgur)', 'aria-label': 'Custom mask URL' });
    this.customMessage = message();
    this.customFile = el('input', { type: 'file', accept: 'image/*', className: 'visually-hidden', 'aria-label': 'Mask image file' });
    this.customInput.addEventListener('input', () => this.customMessage.set(''));
    this.customInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.saveCustomMask();
      }
    });
    this.customFile.addEventListener('change', () => {
      const [file] = this.customFile.files ?? [];

      if (file) {
        this.app.addFileMask(file);
      }

      this.customFile.value = '';
    });
    this.renderCustomGrid();

    return el('div', { className: 'library-tab hidden' }, [
      this.customEmpty,
      this.customGrid,
      el('div', { className: 'stack' }, [
        this.customInput,
        el('div', { className: 'button-row' }, [
          button('Submit mask', { id: 'submitmask', onClick: () => this.saveCustomMask() }),
          button('Delete masks', {
            id: 'deletemask',
            onClick: () => {
              this.app.maskStorage.clearAll();
              this.renderCustomGrid();
              this.customMessage.set('All custom masks were removed.', 'info');
            },
          }),
        ]),
        button('Use an image file as a mask', { iconName: 'upload', onClick: () => this.customFile.click() }),
        this.customFile,
        this.customMessage.element,
      ]),
    ]);
  }

  saveCustomMask() {
    const url = this.customInput.value.trim();

    if (!url) {
      this.customMessage.set('Enter a mask URL first.', 'warning');
      this.customInput.focus();
      return;
    }

    this.app.maskStorage.addMask(url);
    this.customInput.value = '';
    this.renderCustomGrid();
    this.customMessage.set('Custom mask saved for reuse.', 'success');
  }

  renderCustomGrid() {
    const urls = this.app.maskStorage.getMasks();

    this.customEmpty.classList.toggle('hidden', urls.length > 0);
    this.customGrid.replaceChildren(
      ...urls.map((url, index) =>
        this.tile({ label: `Custom ${index + 1}`, title: url, image: url, onPick: (options) => this.app.addCustomMask(url, options) })
      )
    );
  }

  // ── live thumbnails ───────────────────────────────────────────────────────

  scheduleThumbs(delay = 0) {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => this.refreshThumbs(), delay);
  }

  /** Small render of the picture without any masks; falls back to a sample scene. */
  thumbSource() {
    const { store, stage } = this.app;
    const compositor = stage.compositor;

    if (store.hasImage) {
      const doc = store.doc;
      const images = doc.layers.filter((layer) => layer.type === 'image' && layer.visible);

      if (images.length) {
        return compositor.render(doc, {
          scale: THUMB_WIDTH / Math.max(doc.width, doc.height),
          only: new Set(images.map((layer) => layer.id)),
        });
      }
    }

    const sample = createSampleScene(THUMB_WIDTH, Math.round(THUMB_WIDTH * 0.72));

    return compositor.targetFromSource(sample, sample.width, sample.height);
  }

  refreshThumbs() {
    const job = (this.thumbJob += 1);
    const { stage } = this.app;
    let source;

    try {
      source = this.thumbSource();
    } catch (error) {
      console.error(error);
      return;
    }

    let index = 0;
    const step = () => {
      if (job !== this.thumbJob || stage.glx.lost) {
        stage.glx.release(source);
        return;
      }

      const end = Math.min(this.thumbs.length, index + 8);

      for (; index < end; index += 1) {
        const thumb = this.thumbs[index];

        try {
          const image = thumb.render(source);

          thumb.canvas.width = image.width;
          thumb.canvas.height = image.height;
          thumb.canvas.getContext('2d').putImageData(image, 0, 0);
        } catch (error) {
          console.error(error);
        }
      }

      if (index < this.thumbs.length) {
        requestAnimationFrame(step);
      } else {
        stage.glx.release(source);
        stage.afterOffscreenRender();
      }
    };

    step();
  }
}
