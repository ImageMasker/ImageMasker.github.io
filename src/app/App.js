// Application shell: builds the layout, owns the shared services and exposes the editing
// commands that panels, tools and keyboard shortcuts call.

import { AssetStore } from '../core/AssetStore.js';
import { EventBus } from '../core/EventBus.js';
import {
  cloneLayer,
  createDoc,
  effectLayer,
  imageLayer,
  insertLayer,
  isBoxLayer,
  maskLayer,
  moveLayer,
  patternLayer,
  rebaseDoc,
  rectLayer,
  removeLayers,
  textLayer,
  updateLayer,
} from '../core/model.js';
import { Store } from '../core/Store.js';
import { defaultParams, getEffect } from '../gl/effects.js';
import { ImgurUploader } from '../integrations/ImgurUploader.js';
import { RedditPoster } from '../integrations/RedditPoster.js';
import { RISChecker } from '../integrations/RISChecker.js';
import { loadFlagMaskCatalog } from '../masks/FlagMaskCatalog.js';
import { MaskStorage } from '../storage/MaskStorage.js';
import { RoundStorage } from '../storage/RoundStorage.js';
import { Settings } from '../storage/Settings.js';
import { BrushTool } from '../tools/BrushTool.js';
import { CropTool } from '../tools/CropTool.js';
import { RegionTool } from '../tools/RegionTool.js';
import { SelectTool } from '../tools/SelectTool.js';
import { TextEditor } from '../tools/TextEditor.js';
import { Inspector } from '../ui/Inspector.js';
import { KeyboardShortcuts } from '../ui/KeyboardShortcuts.js';
import { button, icon, iconButton } from '../ui/kit.js';
import { LayersPanel } from '../ui/LayersPanel.js';
import { LibraryPanel } from '../ui/LibraryPanel.js';
import { SharePanel } from '../ui/SharePanel.js';
import { ThemeManager } from '../ui/ThemeManager.js';
import { ToastManager } from '../ui/ToastManager.js';
import { el } from '../utils/dom.js';
import { Stage } from '../view/Stage.js';
import { AiTools } from './ai.js';
import { AUTOSAVE_ID, describeSession, restoreSession, SessionStore } from './sessions.js';
import { SettingsUi } from './settingsUi.js';

const TOOL_BUTTONS = [
  { id: 'select', icon: 'select', label: 'Move mode', short: 'Move', command: 'move' },
  { id: 'brush', icon: 'brush', label: 'Brush mode', short: 'Brush', command: 'brush' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', short: 'Eraser', command: 'eraser' },
  { id: 'paint', icon: 'paint', label: 'Effect brush', short: 'Fx brush', command: 'blurBrush' },
  { id: 'region', icon: 'region', label: 'Add region', short: 'Region', command: 'addRegion' },
  { id: 'rect', icon: 'rect', label: 'Add rectangle', short: 'Rect', command: 'addRectangle', action: 'addRectangle' },
  { id: 'text', icon: 'text', label: 'Add text', short: 'Text', command: 'addText', action: 'addText' },
  { id: 'crop', icon: 'crop', label: 'Crop / Resize', short: 'Crop', command: 'crop' },
];
const SIDE_TABS = [
  { id: 'edit', label: 'Edit' },
  { id: 'share', label: 'Share' },
  { id: 'ai', label: 'AI' },
];
const MOBILE_TABS = [{ id: 'masks', label: 'Masks' }, ...SIDE_TABS];
const GITHUB_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 0 0 7.860 10.917c.575.106.785-.250.785-.554 0-.273-.010-.996-.016-1.955-3.197.695-3.872-1.540-3.872-1.540-.522-1.327-1.275-1.680-1.275-1.680-1.042-.712.080-.698.080-.698 1.153.080 1.760 1.184 1.760 1.184 1.024 1.755 2.687 1.248 3.342.954.104-.742.401-1.248.730-1.535-2.552-.290-5.237-1.276-5.237-5.680 0-1.255.448-2.282 1.183-3.087-.118-.290-.513-1.458.112-3.040 0 0 .965-.309 3.162 1.179A10.950 10.950 0 0 1 12 6.042c.974.005 1.955.132 2.872.387 2.195-1.488 3.158-1.180 3.158-1.180.627 1.584.232 2.752.114 3.041.737.805 1.182 1.832 1.182 3.087 0 4.415-2.690 5.386-5.250 5.670.412.355.779 1.058.779 2.133 0 1.540-.014 2.782-.014 3.160 0 .307.207.665.790.553A11.502 11.502 0 0 0 23.500 12C23.500 5.648 18.352.500 12 .500Z"></path></svg>';

export class App {
  constructor(container) {
    this.container = container;
    this.bus = new EventBus();
    this.settings = new Settings();
    this.themeManager = new ThemeManager(this.settings);
    this.maskStorage = new MaskStorage();
    this.roundStorage = new RoundStorage();
    this.sessionStore = new SessionStore();
    this.assets = new AssetStore();
    this.store = new Store();
    this.redditPoster = new RedditPoster();
    this.imgurUploader = new ImgurUploader(this.settings);
    this.risChecker = new RISChecker((text, tone) => this.notify(text, tone));
    this.toasts = new ToastManager();
    this.toolState = {
      brush: { size: 10, color: '#000000', type: 'smooth', opacity: 100 },
      paint: { effectId: 'blur' },
      region: { shape: 'rect', effectId: 'blur' },
      text: {},
    };
    this.toolName = 'select';
    this.tools = {};
    this.refs = { toolButtons: {}, sideTabs: {}, sidePanels: {}, mobileTabs: {} };
    this.autosaveTimer = 0;
    this.restoring = false;
    this.flagCatalogPromise = null;
  }

  async init() {
    this.render();
    this.themeManager.init(this.root);

    try {
      this.stage = new Stage({ host: this.refs.canvasHost, store: this.store, assets: this.assets, bus: this.bus });
    } catch (error) {
      this.refs.dropTitle.textContent = 'This browser cannot run the editor';
      this.refs.dropSubtitle.textContent = `${error.message} The previous version is still available from the link below.`;
      this.refs.dropTarget.disabled = true;
      this.refs.fallbackLink.classList.remove('hidden');
      return;
    }

    this.assets.maxSize = Math.min(this.stage.glx.maxTextureSize, 8192);
    this.assets.flagCatalog = () => this.flagCatalog();
    this.textEditor = new TextEditor(this);
    this.tools = {
      select: new SelectTool(this),
      brush: new BrushTool(this, 'brush'),
      eraser: new BrushTool(this, 'eraser'),
      paint: new BrushTool(this, 'paint'),
      region: new RegionTool(this),
      crop: new CropTool(this),
    };

    this.library = new LibraryPanel(this);
    this.layersPanel = new LayersPanel(this);
    this.inspector = new Inspector(this);
    this.sharePanel = new SharePanel(this);
    this.ai = new AiTools(this);
    this.settingsUi = new SettingsUi(this);
    this.refs.library.append(this.library.element);
    this.refs.sidePanels.edit.append(this.layersPanel.element, this.inspector.element);
    this.refs.sidePanels.share.append(this.sharePanel.element);
    this.refs.sidePanels.ai.append(this.ai.element);
    this.root.append(this.settingsUi.element, this.toasts.element);

    this.bindEvents();
    this.initKeyboard();
    this.settingsUi.renderThemes();
    this.settingsUi.renderShortcuts();
    this.setTool('select');
    this.setSideTab('edit');
    this.syncChrome();
    this.library.scheduleThumbs(50);
    void this.ai.init();
    void this.checkAutosave();
  }

  // ── layout ────────────────────────────────────────────────────────────────

  render() {
    const refs = this.refs;
    const headerButton = (iconName, title, onClick) => iconButton(iconName, title, onClick, 'header-button');

    refs.undo = headerButton('undo', 'Undo', () => this.undo());
    refs.redo = headerButton('redo', 'Redo', () => this.redo());
    refs.zoomOut = headerButton('zoomOut', 'Zoom out', () => this.stage.zoomAt(1 / 1.25));
    refs.zoomLabel = button('100%', { id: 'zoomLabel', className: 'header-button zoom-label', title: 'Show at actual size', onClick: () => this.stage.setZoom(1) });
    refs.zoomIn = headerButton('zoomIn', 'Zoom in', () => this.stage.zoomAt(1.25));
    refs.fit = headerButton('fit', 'Fit picture to screen', () => this.stage.fit());
    refs.compare = button('Original', { iconName: 'compare', className: 'header-button', title: 'Hold to see the picture without masks' });
    refs.copy = button('Copy', { iconName: 'clipboard', className: 'header-button', title: 'Copy image to clipboard', onClick: () => this.copyImage() });
    refs.download = button('Download', { iconName: 'download', className: 'header-button', title: 'Download image', onClick: () => this.downloadImage() });
    refs.settings = el('button', { id: 'settingsButton', type: 'button', textContent: 'Settings', 'aria-label': 'Open settings' });
    refs.github = el('button', { id: 'github', type: 'button', 'aria-label': 'GitHub', title: 'Source on GitHub', innerHTML: GITHUB_ICON });

    const header = el('header', { className: 'app-header' }, [
      el('div', { className: 'brand' }, [
        el('img', { src: 'images/favicon.png', alt: '', width: '26', height: '26' }),
        el('span', { className: 'brand-name', textContent: 'Image Masker' }),
      ]),
      el('div', { className: 'header-group' }, [refs.undo, refs.redo]),
      el('div', { className: 'header-group' }, [refs.zoomOut, refs.zoomLabel, refs.zoomIn, refs.fit]),
      el('div', { className: 'header-group' }, [refs.compare]),
      el('div', { className: 'header-spacer' }),
      el('div', { className: 'header-group header-group--export' }, [refs.copy, refs.download]),
      el('div', { className: 'chrome-controls' }, [refs.settings, refs.github]),
    ]);

    refs.toolRail = el(
      'div',
      { className: 'tool-rail', role: 'toolbar', 'aria-label': 'Tools' },
      TOOL_BUTTONS.map((tool) => {
        const toolButton = el('button', { type: 'button', className: 'tool-button', 'aria-label': tool.label, 'data-tool': tool.id }, [
          icon(tool.icon),
          el('span', { className: 'tool-button-label', textContent: tool.short }),
        ]);

        toolButton.addEventListener('click', () => (tool.action ? this[tool.action]() : this.setTool(tool.id)));
        refs.toolButtons[tool.id] = toolButton;
        return toolButton;
      })
    );

    refs.fileInput = el('input', { id: 'imageUpload', type: 'file', accept: 'image/*', className: 'visually-hidden', 'aria-label': 'Upload image file' });
    refs.dropTitle = el('div', { className: 'drop-overlay-title', textContent: 'Drop an image here' });
    refs.dropSubtitle = el('div', { className: 'drop-overlay-subtitle', textContent: 'or paste from clipboard, or click to browse' });
    refs.dropTarget = el('button', { type: 'button', className: 'drop-target', 'aria-label': 'Drop an image, paste from clipboard, or click to upload' }, [
      el('div', { className: 'drop-overlay-icon', textContent: '📂' }),
      refs.dropTitle,
      refs.dropSubtitle,
    ]);
    refs.dropUrl = el('input', { type: 'url', placeholder: 'Or paste the image URL here...', 'aria-label': 'Image URL', className: 'drop-url' });
    refs.restoreBanner = el('div', { className: 'session-restore-banner hidden' }, [
      el('div', { className: 'session-restore-message', textContent: 'Restore the last autosaved session?' }),
      el('div', { className: 'session-actions-row' }, [
        button('Restore', { onClick: () => this.restoreAutosave() }),
        button('Discard', { onClick: () => this.discardAutosave() }),
      ]),
    ]);
    refs.fallbackLink = el('a', { className: 'app-button link-button hidden', href: 'old/v2/', textContent: 'Open the previous version' });
    refs.dropOverlay = el('div', { className: 'drop-overlay' }, [
      refs.dropTarget,
      el('div', { className: 'input-row drop-url-row' }, [refs.dropUrl, button('Load', { onClick: () => this.loadFromUrlInput(refs.dropUrl) })]),
      refs.restoreBanner,
      refs.fallbackLink,
    ]);
    refs.canvasHost = el('div', { id: 'canvasDiv' });
    refs.status = el('div', { className: 'workflow-status', 'aria-live': 'polite' });
    refs.library = el('aside', { id: 'toolsDiv', className: 'side-column', 'data-mobile-group': 'masks' });

    const sideTabs = el(
      'div',
      { className: 'tab-strip side-tabs', role: 'tablist' },
      SIDE_TABS.map((tab) => {
        const tabButton = el('button', { type: 'button', className: 'tab-button', textContent: tab.label, role: 'tab' });

        tabButton.addEventListener('click', () => this.setSideTab(tab.id));
        refs.sideTabs[tab.id] = tabButton;
        refs.sidePanels[tab.id] = el('div', { className: 'side-tab-panel hidden', 'data-side-panel': tab.id });
        return tabButton;
      })
    );

    refs.mobileNav = el(
      'nav',
      { className: 'mobile-panel-nav', 'aria-label': 'Editor panels' },
      MOBILE_TABS.map((tab) => {
        const tabButton = el('button', { type: 'button', className: 'mobile-panel-button', textContent: tab.label });

        tabButton.addEventListener('click', () => this.setMobilePanel(tab.id));
        refs.mobileTabs[tab.id] = tabButton;
        return tabButton;
      })
    );

    this.root = el('div', { className: 'app-root', 'data-layout-columns': 'default', 'data-mobile-panel': 'masks' }, [
      header,
      el('div', { id: 'container', className: 'app-grid' }, [
        refs.library,
        el('main', { id: 'preview' }, [
          refs.toolRail,
          el('div', { className: 'canvas-stage' }, [refs.canvasHost, refs.dropOverlay, refs.status, refs.fileInput]),
        ]),
        el('aside', { id: 'masksDiv', className: 'side-column' }, [sideTabs, ...Object.values(refs.sidePanels)]),
      ]),
      refs.mobileNav,
    ]);
    this.container.replaceChildren(this.root);
    this.setMobilePanel('masks');
  }

  setSideTab(id) {
    for (const tab of SIDE_TABS) {
      this.refs.sideTabs[tab.id].classList.toggle('is-active', tab.id === id);
      this.refs.sideTabs[tab.id].setAttribute('aria-selected', tab.id === id ? 'true' : 'false');
      this.refs.sidePanels[tab.id].classList.toggle('hidden', tab.id !== id);
    }

    this.sideTab = id;
  }

  setMobilePanel(id) {
    this.root.dataset.mobilePanel = id;

    for (const tab of MOBILE_TABS) {
      this.refs.mobileTabs[tab.id].classList.toggle('is-active', tab.id === id);
    }

    if (id !== 'masks' && this.refs.sideTabs[id]) {
      this.setSideTab(id);
    }
  }

  /** Enables/disables chrome that depends on the document and the history. */
  syncChrome() {
    const { store, refs } = this;
    const loaded = store.hasImage;

    this.root.classList.toggle('has-image', loaded);
    refs.dropOverlay.classList.toggle('hidden', loaded);
    refs.undo.disabled = !store.undoStack.length;
    refs.redo.disabled = !store.redoStack.length;

    for (const control of [refs.zoomOut, refs.zoomLabel, refs.zoomIn, refs.fit, refs.compare, refs.copy, refs.download]) {
      control.disabled = !loaded;
    }

    for (const toolButton of Object.values(refs.toolButtons)) {
      toolButton.disabled = !loaded;
    }

    refs.status.textContent = loaded ? `${store.doc.width} × ${store.doc.height} px` : '';
  }

  updateShortcutHints() {
    for (const tool of TOOL_BUTTONS) {
      const binding = this.keyboard?.getBinding(tool.command) ?? '';

      this.refs.toolButtons[tool.id].title = binding ? `${tool.label} (${binding})` : tool.label;
    }

    this.refs.undo.title = `Undo (${this.keyboard?.getBinding('undo') ?? ''})`;
    this.refs.redo.title = `Redo (${this.keyboard?.getBinding('redo') ?? ''})`;
  }

  // ── events ────────────────────────────────────────────────────────────────

  bindEvents() {
    const { refs, store, bus } = this;
    let lastSize = '';

    store.on('doc', (doc) => {
      const size = `${doc.width}x${doc.height}`;

      if (size !== lastSize) {
        lastSize = size;
        this.stage.fit();
      }

      this.syncChrome();
      this.queueAutosave();
    });
    store.on('history', () => this.syncChrome());
    bus.on('view', (view) => {
      refs.zoomLabel.querySelector('span').textContent = `${Math.round(view.zoom * 100)}%`;
    });
    bus.on('render-error', () => this.notify('The picture could not be rendered. Try a smaller image or fewer layers.', 'error', 5000));

    refs.settings.addEventListener('click', () => this.settingsUi.open('sessions'));
    refs.github.addEventListener('click', () => window.open('https://github.com/ImageMasker/ImageMasker.github.io'));

    const compare = (enabled) => () => {
      this.stage.setCompare(enabled);
      refs.compare.classList.toggle('is-active', enabled);
    };

    refs.compare.addEventListener('pointerdown', compare(true));
    refs.compare.addEventListener('pointerup', compare(false));
    refs.compare.addEventListener('pointerleave', compare(false));
    refs.compare.addEventListener('pointercancel', compare(false));

    refs.dropTarget.addEventListener('click', () => this.pickFile('base'));
    refs.dropUrl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.loadFromUrlInput(refs.dropUrl);
      }
    });
    refs.fileInput.addEventListener('change', () => {
      const [file] = refs.fileInput.files ?? [];
      const mode = refs.fileInput.dataset.mode;

      refs.fileInput.value = '';

      if (file) {
        void (mode === 'layer' && store.hasImage ? this.addImageLayerFromBlob(file, file.name) : this.openBlob(file, file.name));
      }
    });

    this.root.addEventListener('dragover', (event) => {
      if ([...(event.dataTransfer?.types ?? [])].includes('Files')) {
        event.preventDefault();
        this.root.classList.add('is-drag-over');
      }
    });
    this.root.addEventListener('dragleave', (event) => {
      if (!this.root.contains(event.relatedTarget)) {
        this.root.classList.remove('is-drag-over');
      }
    });
    this.root.addEventListener('drop', (event) => {
      const file = [...(event.dataTransfer?.files ?? [])].find((entry) => entry.type.startsWith('image/'));

      this.root.classList.remove('is-drag-over');

      if (file) {
        event.preventDefault();
        void this.openBlob(file, file.name);
      }
    });
    document.addEventListener('paste', (event) => this.handlePaste(event));

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !this.isTyping(event.target)) {
        event.preventDefault();
        this.stage.setSpaceDown(true);
      } else if (event.key === 'Escape' && this.settingsUi.isOpen && !this.settingsUi.captureId) {
        this.settingsUi.close();
      } else if (event.key === 'Enter' && this.toolName === 'crop' && !this.isTyping(event.target)) {
        this.applyCrop();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z' && !this.isTyping(event.target)) {
        event.preventDefault();
        this.redo();
      }
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        this.stage.setSpaceDown(false);
      }
    });
    window.addEventListener('blur', () => this.stage.setSpaceDown(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.persistAutosave();
      }
    });
  }

  initKeyboard() {
    this.keyboard = new KeyboardShortcuts({
      settings: this.settings,
      shouldIgnoreShortcut: () => this.settingsUi.isOpen || Boolean(this.textEditor.layerId),
      handlers: {
        undo: () => this.undo(),
        redo: () => this.redo(),
        copyCanvas: () => void this.copyImage(),
        duplicate: () => this.duplicateSelected(),
        delete: () => this.deleteSelected(),
        brush: () => this.setTool('brush'),
        eraser: () => this.setTool('eraser'),
        move: () => this.setTool('select'),
        blurBrush: () => this.setEffectBrush('blur'),
        pixelBrush: () => this.setEffectBrush('pixelate'),
        crop: () => this.setTool('crop'),
        addRectangle: () => this.addRectangle(),
        addText: () => this.addText(),
        addRegion: () => this.setTool('region'),
        brushSizeUp: () => this.adjustBrushSize(5),
        brushSizeDown: () => this.adjustBrushSize(-5),
        stepLeft: () => (this.sharePanel.roundsOpen ? this.sharePanel.stepRound(-1) : this.rotateSelected(-2)),
        stepRight: () => (this.sharePanel.roundsOpen ? this.sharePanel.stepRound(1) : this.rotateSelected(2)),
        opacityDown: () => this.adjustOpacity(-0.1),
        opacityUp: () => this.adjustOpacity(0.1),
        nudgeLeft: () => this.nudgeSelected(-10, 0),
        nudgeRight: () => this.nudgeSelected(10, 0),
        nudgeDown: () => this.nudgeSelected(0, 10),
        nudgeUp: () => this.nudgeSelected(0, -10),
        customSubreddit: () => {
          this.setSideTab('share');
          this.setMobilePanel('share');
          this.sharePanel.showSubredditInput();
        },
        fitView: () => this.store.hasImage && this.stage.fit(),
        compare: () => {
          if (this.store.hasImage) {
            this.stage.setCompare(!this.stage.compare);
            this.refs.compare.classList.toggle('is-active', this.stage.compare);
          }
        },
        deselect: () => {
          if (this.toolName === 'crop' || this.toolName === 'region') {
            this.setTool('select');
          } else {
            this.store.select([]);
          }
        },
      },
    });
    this.keyboard.init();
  }

  isTyping(target) {
    const tag = target?.tagName;

    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true;
  }

  // ── feedback ──────────────────────────────────────────────────────────────

  notify(text, tone = 'info', duration = 2400) {
    this.toasts.show(text, tone, duration);
  }

  flashButton(target, text = 'Saved!', duration = 1600) {
    const label = target.querySelector('span:last-child') ?? target;
    const original = target.dataset.label ?? label.textContent;

    target.dataset.label = original;
    label.textContent = text;
    target.classList.add('is-success');
    clearTimeout(target.flashTimer);
    target.flashTimer = setTimeout(() => {
      label.textContent = original;
      target.classList.remove('is-success');
    }, duration);
  }

  requireImage(text = 'Load an image first.') {
    if (this.store.hasImage) {
      return true;
    }

    this.notify(text, 'warning');
    return false;
  }

  // ── tools ─────────────────────────────────────────────────────────────────

  setTool(name) {
    if (!this.tools[name] || (name !== 'select' && !this.requireImage())) {
      return;
    }

    this.textEditor.close();
    this.toolName = name;
    this.stage.setTool(this.tools[name]);

    for (const [id, toolButton] of Object.entries(this.refs.toolButtons)) {
      toolButton.classList.toggle('is-active', id === name);
      toolButton.setAttribute('aria-pressed', id === name ? 'true' : 'false');
    }

    if (name !== 'select') {
      this.setSideTab('edit');
    }

    this.bus.emit('tool', name);
  }

  setEffectBrush(effectId) {
    this.toolState.paint.effectId = effectId;
    this.inspector.key = '';
    this.setTool('paint');
  }

  adjustBrushSize(delta) {
    const brush = this.toolState.brush;

    brush.size = Math.max(1, Math.min(100, brush.size + delta));
    this.bus.emit('tool-settings');
    this.inspector.update();
  }

  applyCrop() {
    const changed = this.tools.crop.apply();

    this.setTool('select');

    if (changed) {
      this.store.select([]);
    }
  }

  // ── history ───────────────────────────────────────────────────────────────

  undo() {
    this.textEditor.close();
    this.stage.tool?.onCancel?.();
    this.store.undo();
  }

  redo() {
    this.textEditor.close();
    this.store.redo();
  }

  // ── loading pictures ──────────────────────────────────────────────────────

  pickFile(mode) {
    this.refs.fileInput.dataset.mode = mode;
    this.refs.fileInput.click();
  }

  isImageUrl(url) {
    return /^https?:\/\/\S+\.(jpeg|jpg|png|gif|webp)(?:[?#]\S*)?$/i.test(url.trim());
  }

  async openBlob(blob, name = '') {
    try {
      this.setBase(await this.assets.fromBlob(blob, { name }));
      return true;
    } catch (error) {
      console.error(error);
      this.notify('Something went wrong while loading the image.', 'error');
      return false;
    }
  }

  async openUrl(url) {
    try {
      this.setBase(await this.assets.fromUrl(url.trim()));
      return true;
    } catch (error) {
      console.error(error);
      this.notify('Something went wrong while loading the image URL.', 'error');
      return false;
    }
  }

  async loadFromUrlInput(input) {
    const url = input.value.trim();

    if (!url) {
      return;
    }

    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
      this.notify('Enter a full image URL starting with http:// or https://.', 'warning');
      return;
    }

    const asLayer = this.store.hasImage && this.settings.getPasteImageAsLayer() && input !== this.refs.dropUrl;

    if (await (asLayer ? this.addImageLayerFromUrl(url) : this.openUrl(url))) {
      input.value = '';
    }
  }

  /** Makes `asset` the base picture. Existing masks are carried over to the new picture. */
  setBase(asset) {
    const { store } = this;

    if (asset.downscaled) {
      this.notify('That picture is larger than this device can handle, so it was scaled down.', 'warning', 5000);
    }

    if (store.hasImage) {
      this.textEditor.close();
      store.apply('Replace image', (doc) => rebaseDoc(doc, asset));
      store.select([]);
      this.afterImageChange();
    } else {
      const doc = createDoc(asset.width, asset.height);

      doc.layers.push(imageLayer(doc, asset, { name: 'Base image', base: true }));
      this.replaceDocument(doc);
    }

    this.sharePanel.setUploaded('');
  }

  replaceDocument(doc) {
    this.textEditor?.close();
    this.store.reset(doc, true);
    this.afterImageChange();
  }

  afterImageChange() {
    this.stage.fit();
    this.syncChrome();
    this.refs.restoreBanner.classList.add('hidden');
    this.settingsUi.showRestorePrompt(false);
    this.bus.emit('image-changed');
  }

  async addImageLayerFromBlob(blob, name = '') {
    try {
      this.addImageLayer(await this.assets.fromBlob(blob, { name }), name);
      return true;
    } catch (error) {
      console.error(error);
      this.notify('Something went wrong while adding the image as a layer.', 'error');
      return false;
    }
  }

  async addImageLayerFromUrl(url) {
    try {
      this.addImageLayer(await this.assets.fromUrl(url.trim()), '');
      return true;
    } catch (error) {
      console.error(error);
      this.notify('Something went wrong while adding the image URL as a layer.', 'error');
      return false;
    }
  }

  addImageLayer(asset, name) {
    const cleaned = String(name ?? '').trim().replace(/\.[^.]+$/, '');
    const layer = imageLayer(this.store.doc, asset, { name: !cleaned || /^image$/i.test(cleaned) ? 'Pasted image' : cleaned });

    this.store.apply('Add image', (doc) => insertLayer(doc, layer));
    this.store.select([layer.id]);
    this.setTool('select');
    this.bus.emit('image-changed');
  }

  handlePaste(event) {
    const items = [...(event.clipboardData?.items ?? [])];
    const target = event.target;
    const share = this.sharePanel.refs;

    if (!items.length || this.settingsUi.isOpen) {
      return;
    }

    const text = event.clipboardData.getData('text/plain').trim();

    if (target === share.ris) {
      if (text) {
        setTimeout(() => this.risChecker.check(text), 0);
      }
      return;
    }

    const urlField = target === share.pasteUrl || target === this.refs.dropUrl;

    if (this.isTyping(target) && !urlField) {
      return;
    }

    const asLayer = this.store.hasImage && this.settings.getPasteImageAsLayer();
    const file = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();

    if (file) {
      event.preventDefault();
      void (asLayer ? this.addImageLayerFromBlob(file, file.name) : this.openBlob(file, file.name));
      return;
    }

    if (text && this.isImageUrl(text)) {
      event.preventDefault();
      void (asLayer ? this.addImageLayerFromUrl(text) : this.openUrl(text));
    }
  }

  // ── masks ─────────────────────────────────────────────────────────────────

  flagCatalog() {
    this.flagCatalogPromise ??= loadFlagMaskCatalog();
    return this.flagCatalogPromise;
  }

  /** Adds an effect mask, or swaps the effect of the selected effect layer. */
  addEffect(effectId, { stack = false } = {}) {
    if (!this.requireImage('Load an image before adding a mask.')) {
      return;
    }

    const selected = this.store.selectedLayer;

    if (!stack && selected?.type === 'effect') {
      this.changeEffect(selected.id, effectId);
      return;
    }

    const layer = effectLayer(this.store.doc, effectId);

    this.store.apply('Add effect mask', (doc) => insertLayer(doc, layer));
    this.store.select([layer.id]);
    this.revealEditor();
  }

  changeEffect(layerId, effectId) {
    const definition = getEffect(effectId);

    this.store.apply('Change effect', (doc) =>
      updateLayer(doc, layerId, (layer) => ({
        effectId: definition.id,
        params: defaultParams(definition),
        name: layer.name === getEffect(layer.effectId).name ? definition.name : layer.name,
      }))
    );
  }

  setCoverage(layerId, coverage) {
    const doc = this.store.doc;
    const full = coverage === 'full';

    this.store.apply(full ? 'Apply to whole picture' : 'Limit to region', (current) =>
      updateLayer(current, layerId, {
        coverage,
        points: null,
        strokes: null,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        x: doc.width / 2,
        y: doc.height / 2,
        w: full ? doc.width : doc.width * 0.5,
        h: full ? doc.height : doc.height * 0.5,
      })
    );

    if (!full) {
      this.setTool('select');
    }
  }

  /** Inserts an overlay mask; replaces the selected overlay mask unless stacking. */
  placeMask(layer, { stack = false } = {}) {
    const selected = this.store.selectedLayer;

    if (!stack && selected?.type === 'mask') {
      const carried = { ...layer, opacity: selected.opacity, blend: selected.blend };

      this.store.apply('Change mask', (doc) => {
        const index = doc.layers.findIndex((entry) => entry.id === selected.id);

        return insertLayer(removeLayers(doc, [selected.id]), carried, index);
      });
    } else {
      this.store.apply('Add mask', (doc) => insertLayer(doc, layer));
    }

    this.store.select([layer.id]);
    this.revealEditor();
  }

  revealEditor() {
    this.setSideTab('edit');
  }

  addPattern(patternId, options) {
    if (this.requireImage('Load an image before adding a mask.')) {
      this.placeMask(patternLayer(this.store.doc, patternId), options);
    }
  }

  async addAssetMask(load, layerOptions, options) {
    if (!this.requireImage('Load an image before adding a mask.')) {
      return;
    }

    try {
      this.placeMask(maskLayer(this.store.doc, await load(), layerOptions), options);
    } catch (error) {
      console.error(error);
      this.notify('That mask could not be loaded.', 'error');
    }
  }

  addPresetMask(preset, options) {
    return this.addAssetMask(() => this.assets.fromPath(preset.full, { name: `Classic ${preset.id}` }), { name: `Classic ${preset.id}` }, options);
  }

  addFlagMask(flag, options) {
    return this.addAssetMask(() => this.assets.fromFlag(flag), { name: flag.name, zoom: 67, deform: false }, options);
  }

  addCustomMask(url, options) {
    return this.addAssetMask(() => this.assets.fromUrl(url, { name: 'Custom mask' }), { name: 'Custom mask' }, options);
  }

  addFileMask(file) {
    return this.addAssetMask(() => this.assets.fromBlob(file, { name: file.name }), { name: file.name.replace(/\.[^.]+$/, '') || 'Mask' }, { stack: false });
  }

  retiltMask(layerId) {
    this.store.apply('Re-tilt mask', (doc) =>
      updateLayer(doc, layerId, {
        rotation: ((Math.random() * 4 - 2) * Math.PI) / 180,
        skewX: Math.random() / 5 - 0.1,
        skewY: Math.random() / 5 - 0.1,
      })
    );
  }

  // ── shapes and text ───────────────────────────────────────────────────────

  addRectangle() {
    if (!this.requireImage()) {
      return;
    }

    const layer = { ...rectLayer(this.store.doc, { color: this.toolState.brush.color }), opacity: this.toolState.brush.opacity / 100 };

    this.store.apply('Add rectangle', (doc) => insertLayer(doc, layer));
    this.store.select([layer.id]);
    this.setTool('select');
  }

  addText() {
    if (!this.requireImage()) {
      return;
    }

    const { size, text, ...style } = this.toolState.text;
    const layer = textLayer(this.store.doc, style);

    this.setTool('select');
    this.store.begin();
    this.store.set(insertLayer(this.store.doc, layer));
    this.store.select([layer.id]);
    this.textEditor.open(layer.id);
  }

  fitLayerToCanvas(layerId) {
    const doc = this.store.doc;

    this.store.apply('Fit to canvas', (current) =>
      updateLayer(current, layerId, (layer) => {
        const scale = Math.min(doc.width / layer.w, doc.height / layer.h);

        return { x: doc.width / 2, y: doc.height / 2, w: layer.w * scale, h: layer.h * scale, rotation: 0, skewX: 0, skewY: 0 };
      })
    );
  }

  // ── selection commands ────────────────────────────────────────────────────

  /** Selected layers, or the top-most editable layer when nothing is selected. */
  targetLayers() {
    const selected = this.store.selectedLayers;

    if (selected.length) {
      return selected;
    }

    const last = [...this.store.doc.layers].reverse().find((layer) => layer.type !== 'drawing' && !layer.base);

    return last ? [last] : [];
  }

  duplicateSelected() {
    const { store } = this;
    const offset = Math.min(store.doc.width, store.doc.height) * 0.03;
    const clones = this.targetLayers().map((layer) => ({ source: layer.id, clone: cloneLayer(layer, isBoxLayer(layer) ? offset : 0) }));

    if (!clones.length) {
      return;
    }

    store.apply('Duplicate', (doc) =>
      clones.reduce((current, { source, clone }) => insertLayer(current, clone, current.layers.findIndex((layer) => layer.id === source) + 1), doc)
    );
    store.select(clones.map(({ clone }) => clone.id));
  }

  deleteSelected() {
    const { store } = this;
    const layers = store.selectedLayers;
    const removable = layers.filter((layer) => !layer.base);

    if (layers.length && !removable.length) {
      this.notify('The base image cannot be deleted. Hide it instead, or load another picture.', 'info', 3600);
      return;
    }

    if (removable.length) {
      this.textEditor.close();
      store.apply('Delete', (doc) => removeLayers(doc, removable.map((layer) => layer.id)));
      store.select([]);
    }
  }

  reorderSelected(direction) {
    const layer = this.store.selectedLayer;

    if (!layer) {
      return;
    }

    const index = this.store.doc.layers.findIndex((entry) => entry.id === layer.id);
    const next = index + direction;

    if (next >= 0 && next < this.store.doc.layers.length) {
      this.store.apply('Reorder layer', (doc) => moveLayer(doc, layer.id, next));
    }
  }

  nudgeSelected(dx, dy) {
    const layers = this.store.selectedLayers.filter((layer) => isBoxLayer(layer) && !layer.locked);
    const step = 1 / Math.max(0.05, this.stage.view.zoom);

    if (layers.length) {
      this.store.apply('Nudge', (doc) =>
        layers.reduce((current, layer) => updateLayer(current, layer.id, (entry) => ({ x: entry.x + dx * step, y: entry.y + dy * step })), doc)
      );
    }
  }

  adjustOpacity(delta) {
    const layers = this.targetLayers();

    if (layers.length) {
      this.store.apply('Change opacity', (doc) =>
        layers.reduce((current, layer) => updateLayer(current, layer.id, (entry) => ({ opacity: Math.max(0, Math.min(1, entry.opacity + delta)) })), doc)
      );
    }
  }

  rotateSelected(degrees) {
    const layers = this.targetLayers().filter((layer) => isBoxLayer(layer) && !layer.locked);

    if (layers.length) {
      this.store.apply('Rotate', (doc) =>
        layers.reduce((current, layer) => updateLayer(current, layer.id, (entry) => ({ rotation: entry.rotation + (degrees * Math.PI) / 180 })), doc)
      );
    }
  }

  // ── export ────────────────────────────────────────────────────────────────

  exportScale(size) {
    return size === 'editor' ? Math.min(1, this.stage.fitZoom()) : 1;
  }

  async exportBlob({ format = 'png', size = 'original', quality = 0.92 } = {}) {
    this.textEditor.close();

    let canvas = this.stage.renderToCanvas(this.store.doc, { scale: this.exportScale(size) });

    if (format === 'jpeg') {
      const flat = document.createElement('canvas');
      const context = flat.getContext('2d');

      flat.width = canvas.width;
      flat.height = canvas.height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, flat.width, flat.height);
      context.drawImage(canvas, 0, 0);
      canvas = flat;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', quality));

    if (!blob) {
      throw new Error('The image could not be encoded.');
    }

    return blob;
  }

  async copyImage() {
    if (!this.requireImage('Load an image before copying.')) {
      return;
    }

    const issues = [];

    if (!window.isSecureContext) issues.push('this page is not in a secure context; use https:// or http://localhost');
    if (!window.ClipboardItem) issues.push('ClipboardItem is unavailable');
    if (!navigator.clipboard?.write) issues.push('navigator.clipboard.write is unavailable');

    if (issues.length) {
      this.notify(`Clipboard image copy isn't available because ${issues.join('; ')}.`, 'warning', 6200);
      return;
    }

    try {
      // PNG is the only image type every browser accepts on the clipboard.
      const blob = await this.exportBlob({ ...this.sharePanel.getExportOptions(), format: 'png' });

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.notify('Image copied to clipboard.', 'success');
    } catch (error) {
      this.notify(`Clipboard image copy failed. ${error?.name ?? ''} ${error?.message ?? ''}`.trim(), 'warning', 6200);
    }
  }

  async downloadImage() {
    if (!this.requireImage('Load an image before downloading.')) {
      return;
    }

    try {
      const options = this.sharePanel.getExportOptions();
      const url = URL.createObjectURL(await this.exportBlob(options));
      const now = new Date();
      const pad = (value) => String(value).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const link = el('a', { href: url, download: `round ${stamp}.${options.format === 'jpeg' ? 'jpg' : 'png'}` });

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this.notify('Download started.', 'success');
    } catch (error) {
      console.error(error);
      this.notify('Download failed.', 'error');
    }
  }

  copyYml({ roundTitle, roundAnswer, imageUrl }) {
    return this.copyText(
      `masker_round_${Date.now()}:\n  title: |\n    ${roundTitle}\n  url: ${imageUrl}\n  answer: ${roundAnswer}\n`,
      'YML copied to clipboard.'
    );
  }

  async copyText(text, success = 'Copied to clipboard.') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = el('textarea', { readonly: '', style: 'position:absolute;left:-9999px' });

      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    this.notify(success, 'success');
  }

  // ── sessions ──────────────────────────────────────────────────────────────

  async saveSession(id, name) {
    const payload = describeSession(this);
    const records = new Map();

    for (const assetId of payload.assetIds) {
      records.set(assetId, await this.assets.serialize(assetId));
    }

    await this.sessionStore.save({ id, name, updatedAt: payload.savedAt, ...payload }, records);
  }

  async loadSession(id) {
    const stored = await this.sessionStore.load(id);

    if (!stored) {
      throw new Error('That session no longer exists.');
    }

    return this.importSession({ doc: stored.session.doc, ui: stored.session.ui, assets: stored.assets });
  }

  async importSession(payload) {
    this.restoring = true;

    try {
      return await restoreSession(this, payload);
    } finally {
      this.restoring = false;
    }
  }

  queueAutosave() {
    if (!this.store.hasImage || this.restoring) {
      return;
    }

    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => void this.persistAutosave(), 1500);
  }

  async persistAutosave() {
    if (!this.store.hasImage || this.restoring) {
      return;
    }

    if (this.store.gestureBase) {
      this.queueAutosave();
      return;
    }

    clearTimeout(this.autosaveTimer);

    try {
      await this.saveSession(AUTOSAVE_ID, 'Autosave');
    } catch (error) {
      console.warn('Autosave failed', error);
    }
  }

  async checkAutosave() {
    try {
      if (!this.store.hasImage && (await this.sessionStore.hasAutosave())) {
        this.refs.restoreBanner.classList.remove('hidden');
        this.settingsUi.showRestorePrompt(true);
      }
    } catch {
      // IndexedDB can be unavailable (private windows); the editor works without it.
    }
  }

  async restoreAutosave() {
    try {
      const dropped = await this.loadSession(AUTOSAVE_ID);

      this.settingsUi.close();
      this.notify(dropped.length ? `Restored, but some layers were lost: ${dropped.join(', ')}.` : 'Session restored.', dropped.length ? 'warning' : 'success', 3600);
    } catch (error) {
      this.notify(`The autosave could not be restored. ${error.message}`, 'error', 4200);
    }
  }

  async discardAutosave() {
    this.refs.restoreBanner.classList.add('hidden');
    this.settingsUi.showRestorePrompt(false);

    try {
      await this.sessionStore.remove(AUTOSAVE_ID);
    } catch {
      // Nothing to clean up.
    }
  }
}
