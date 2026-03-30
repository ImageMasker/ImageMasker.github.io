import { CanvasEngine } from './core/CanvasEngine.js';
import { SavedRoundsController } from './controllers/SavedRoundsController.js';
import { SessionController } from './controllers/SessionController.js';
import { UiStateController } from './controllers/UiStateController.js';
import { EventBus } from './core/EventBus.js';
import { HistoryManager } from './core/HistoryManager.js';
import { LayerManager } from './core/LayerManager.js';
import { ViewportController } from './core/ViewportController.js';
import { ExportManager } from './export/ExportManager.js';
import { AiImageEditor } from './integrations/AiImageEditor.js';
import { BackgroundRemover } from './integrations/BackgroundRemover.js';
import { ImgurUploader } from './integrations/ImgurUploader.js';
import { MaskEffects } from './masks/MaskEffects.js';
import { MaskManager } from './masks/MaskManager.js';
import { PRESET_MASKS } from './masks/maskData.js';
import { SessionSerializer } from './session/SessionSerializer.js';
import { SessionStorage } from './session/SessionStorage.js';
import { MaskStorage } from './storage/MaskStorage.js';
import { RoundStorage } from './storage/RoundStorage.js';
import { Settings } from './storage/Settings.js';
import { BrushTool } from './tools/BrushTool.js';
import { EraserTool } from './tools/EraserTool.js';
import { RectTool } from './tools/RectTool.js';
import { RegionEffectTool } from './tools/RegionEffectTool.js';
import { PaintEffectManager } from './tools/PaintEffectManager.js';
import { PaintEffectBrushTool } from './tools/PaintEffectBrushTool.js';
import { CropTool } from './tools/CropTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { TextTool } from './tools/TextTool.js';
import { ToolManager } from './tools/ToolManager.js';
import {
  createDefaultRegionEffect,
  getRegionEffectDefinition,
  getRegionPreviewBadge,
} from './tools/regionDefinitions.js';
import { KeyboardShortcuts } from './ui/KeyboardShortcuts.js';
import { AiEditPanel } from './ui/AiEditPanel.js';
import { BackgroundRemovalPanel } from './ui/BackgroundRemovalPanel.js';
import { CanvasArea } from './ui/CanvasArea.js';
import { LayerPanel } from './ui/LayerPanel.js';
import { MaskPanel } from './ui/MaskPanel.js';
import { SavedRoundsPanel } from './ui/SavedRoundsPanel.js';
import { SessionPanel } from './ui/SessionPanel.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { ShortcutsPanel } from './ui/ShortcutsPanel.js';
import { ThemeManager } from './ui/ThemeManager.js';
import { ThemePanel } from './ui/ThemePanel.js';
import { ToastManager } from './ui/ToastManager.js';
import { Toolbar } from './ui/Toolbar.js';
import { RedditPoster } from './integrations/RedditPoster.js';
import { RISChecker } from './integrations/RISChecker.js';
import { addProxyToUrl } from './integrations/CorsProxy.js';
import { el } from './utils/dom.js';
import { loadImageElement } from './utils/image.js';
import {
  applyObjectState,
  objectStatesEqual,
  snapshotObjectState,
} from './utils/objectState.js';

const BACKGROUND_LAYER_ID = 'background-image-layer';

export class App {
  constructor(container) {
    this.container = container;
    this.eventBus = new EventBus();
    this.settings = new Settings();
    this.themeManager = new ThemeManager(this.settings);
    this.maskStorage = new MaskStorage();
    this.roundStorage = new RoundStorage();
    this.sessionStorage = new SessionStorage();
    this.canvasEngine = null;
    this.layerManager = null;
    this.historyManager = null;
    this.viewportController = null;
    this.exportManager = null;
    this.aiImageEditor = null;
    this.backgroundRemover = null;
    this.toolManager = null;
    this.keyboardShortcuts = null;
    this.imgurUploader = null;
    this.redditPoster = new RedditPoster();
    this.risChecker = null;
    this.maskManager = null;
    this.maskEffects = null;
    this.brushTool = null;
    this.eraserTool = null;
    this.blurPaintTool = null;
    this.pixelatePaintTool = null;
    this.rectTool = null;
    this.regionEffectTool = null;
    this.paintEffectManager = null;
    this.cropTool = null;
    this.textTool = null;
    this.selectTool = null;
    this.toolbar = null;
    this.maskPanel = null;
    this.aiEditPanel = null;
    this.backgroundRemovalPanel = null;
    this.layerPanel = null;
    this.canvasArea = null;
    this.sessionPanel = null;
    this.savedRoundsPanel = null;
    this.themePanel = null;
    this.shortcutsPanel = null;
    this.settingsModal = null;
    this.toastManager = null;
    this.appShell = null;
    this.chromeControls = null;
    this.settingsButton = null;
    this.githubButton = null;
    this.savedRoundIndex = 0;
    this.sessionSerializer = null;
    this.currentBackgroundSource = null;
    this.selectedSessionId = '';
    this.autosaveTimeoutId = 0;
    this.isRestoringSession = false;
    this.regionCreationSeed = Math.random();
    this.aiEditCount = 0;
    this.backgroundRemovalCount = 0;
    this.aiEditModels = [];
    this.expandedLayerSettings = new Set();
    this.selectedPanelLayerId = null;
    this.uiStateController = null;
    this.savedRoundsController = null;
    this.sessionController = null;
  }

  async init() {
    if (!this.container) {
      throw new Error('App container "#app" was not found.');
    }

    this.render();
    this.toolbar.refs.paintEffectAmountField.hidden = true;
    this.toolbar.refs.cropActionRow.hidden = true;
    this.risChecker = new RISChecker((message, tone) => this.notify(message, tone));

    this.canvasEngine = new CanvasEngine(this.canvasArea.refs.canvasHost, this.eventBus);
    await this.canvasEngine.init();
    this.viewportController = new ViewportController(this.canvasEngine, this.eventBus);
    this.canvasEngine.viewportController = this.viewportController;
    this.viewportController.init();

    this.layerManager = new LayerManager(this.canvasEngine, this.eventBus);
    this.historyManager = new HistoryManager();
    this.exportManager = new ExportManager(this.canvasEngine);
    this.aiImageEditor = new AiImageEditor();
    this.backgroundRemover = new BackgroundRemover();
    this.sessionSerializer = new SessionSerializer();
    this.uiStateController = new UiStateController(this);
    this.savedRoundsController = new SavedRoundsController(this);
    this.sessionController = new SessionController(this);
    this.imgurUploader = new ImgurUploader(this.canvasEngine, this.settings);
    this.maskManager = new MaskManager(this.canvasEngine, this.layerManager, this.eventBus);
    this.maskEffects = new MaskEffects(this.maskManager);

    this.initializeTools();
    this.initializeKeyboardShortcuts();
    this.initializeTheme();
    this.initializeSettings();
    await this.initializeAiEditPanel();
    this.syncExportControlsFromPreset();
    this.renderLayerPanel();
    this.renderSessions();
    this.renderThemes();
    this.renderShortcuts();
    this.bindEvents();
    this.syncRegionCreationOptionsFromToolbar();
    this.updateRegionEffectControlVisibility();
    this.updateWorkflowStatus();
    this.maybeShowRestorePrompt();
  }

  render() {
    this.toolbar = new Toolbar();
    this.layerPanel = new LayerPanel();
    this.maskPanel = new MaskPanel(this.maskStorage.getMasks());
    this.backgroundRemovalPanel = new BackgroundRemovalPanel();
    this.aiEditPanel = new AiEditPanel();
    this.canvasArea = new CanvasArea();
    this.sessionPanel = new SessionPanel();
    this.savedRoundsPanel = new SavedRoundsPanel();
    this.themePanel = new ThemePanel();
    this.shortcutsPanel = new ShortcutsPanel();
    this.settingsModal = new SettingsModal();
    this.toastManager = new ToastManager();

    this.toolbar.element.appendChild(this.layerPanel.element);
    this.toolbar.element.appendChild(this.canvasArea.refs.actionBar);
    this.toolbar.element.appendChild(this.savedRoundsPanel.element);

    this.settingsButton = el('button', {
      id: 'settingsButton',
      type: 'button',
      textContent: 'Settings',
      'aria-label': 'Open settings',
    });

    this.githubButton = el('button', {
      id: 'github',
      type: 'button',
      'aria-label': 'GitHub',
      innerHTML: `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 0 0 7.86 10.917c.575.106.785-.25.785-.554 0-.273-.01-.996-.016-1.955-3.197.695-3.872-1.54-3.872-1.54-.522-1.327-1.275-1.68-1.275-1.68-1.042-.712.08-.698.08-.698 1.153.08 1.76 1.184 1.76 1.184 1.024 1.755 2.687 1.248 3.342.954.104-.742.401-1.248.73-1.535-2.552-.29-5.237-1.276-5.237-5.68 0-1.255.448-2.282 1.183-3.087-.118-.29-.513-1.458.112-3.04 0 0 .965-.309 3.162 1.179A10.95 10.95 0 0 1 12 6.042c.974.005 1.955.132 2.872.387 2.195-1.488 3.158-1.18 3.158-1.18.627 1.584.232 2.752.114 3.041.737.805 1.182 1.832 1.182 3.087 0 4.415-2.69 5.386-5.25 5.67.412.355.779 1.058.779 2.133 0 1.54-.014 2.782-.014 3.16 0 .307.207.665.79.553A11.502 11.502 0 0 0 23.5 12C23.5 5.648 18.352.5 12 .5Z"></path>
        </svg>`,
    });

    this.chromeControls = el('div', { className: 'chrome-controls' }, [
      this.settingsButton,
      this.githubButton,
    ]);
    this.maskPanel.element.prepend(this.chromeControls);
    this.settingsModal.refs.sessionsContent.appendChild(this.sessionPanel.element);
    this.settingsModal.refs.themesContent.appendChild(this.themePanel.element);
    this.settingsModal.refs.shortcutsContent.appendChild(this.shortcutsPanel.element);

    const grid = el('div', { id: 'container', className: 'app-grid' }, [
      this.toolbar.element,
      this.canvasArea.element,
      this.maskPanel.element,
    ]);

    this.maskPanel.element.appendChild(this.backgroundRemovalPanel.element);
    this.maskPanel.element.appendChild(this.aiEditPanel.element);

    this.appShell = el('div', {
      className: 'app-root',
      'data-layout-columns': 'default',
    }, [
      grid,
      this.settingsModal.element,
      this.toastManager.element,
    ]);

    this.container.replaceChildren(this.appShell);
  }

  initializeTools() {
    const toolbarRefs = this.toolbar.refs;
    const drawingState = {};

    this.toolManager = new ToolManager(this.canvasEngine, this.layerManager, this.eventBus);
    this.brushTool = new BrushTool(this.canvasEngine, this.layerManager, this.eventBus, {
      width: Number(toolbarRefs.brushSizeInput.value),
      color: toolbarRefs.brushColorInput.value,
      opacity: Number(toolbarRefs.brushOpacityInput.value) / 100,
      brushType: toolbarRefs.brushTypeSelect.value,
      sharedState: drawingState,
    });
    this.eraserTool = new EraserTool(this.canvasEngine, this.layerManager, this.eventBus, {
      width: Number(toolbarRefs.brushSizeInput.value),
      sharedState: drawingState,
    });
    this.paintEffectManager = new PaintEffectManager(
      this.canvasEngine,
      this.layerManager,
      this.eventBus,
      this.brushTool
    );
    this.blurPaintTool = new PaintEffectBrushTool(
      this.canvasEngine,
      this.layerManager,
      this.eventBus,
      this.paintEffectManager,
      'blur',
      {
        width: Number(toolbarRefs.brushSizeInput.value),
        opacity: Number(toolbarRefs.brushOpacityInput.value) / 100,
        sharedState: drawingState,
      }
    );
    this.pixelatePaintTool = new PaintEffectBrushTool(
      this.canvasEngine,
      this.layerManager,
      this.eventBus,
      this.paintEffectManager,
      'pixelate',
      {
        width: Number(toolbarRefs.brushSizeInput.value),
        opacity: Number(toolbarRefs.brushOpacityInput.value) / 100,
        sharedState: drawingState,
      }
    );
    this.rectTool = new RectTool(this.canvasEngine, this.layerManager);
    this.regionEffectTool = new RegionEffectTool(this.canvasEngine, this.layerManager, this.eventBus);
    this.cropTool = new CropTool(this.canvasEngine, this.eventBus);
    this.textTool = new TextTool(this.canvasEngine, this.layerManager, this.eventBus);
    this.selectTool = new SelectTool(
      this.canvasEngine,
      this.layerManager,
      this.eventBus,
      this.brushTool,
      this.textTool,
      this.regionEffectTool
    );

    this.toolManager.registerTool('brush', this.brushTool);
    this.toolManager.registerTool('eraser', this.eraserTool);
    this.toolManager.registerTool('blur-brush', this.blurPaintTool);
    this.toolManager.registerTool('pixelate-brush', this.pixelatePaintTool);
    this.toolManager.registerTool('region', this.regionEffectTool);
    this.toolManager.registerTool('crop', this.cropTool);
    this.toolManager.registerTool('select', this.selectTool);
    this.toolManager.setActiveTool('brush');
  }

  initializeKeyboardShortcuts() {
    this.keyboardShortcuts = new KeyboardShortcuts({
      settings: this.settings,
      historyManager: this.historyManager,
      selectTool: this.selectTool,
      savedRoundsElement: this.savedRoundsPanel.refs.savedRounds,
      shouldIgnoreShortcut: () => !this.settingsModal.refs.overlay.classList.contains('hidden'),
      handlers: {
        undo: () => this.historyManager.undo(),
        redo: () => this.historyManager.redo(),
        copyCanvas: () => {
          void this.copyImage();
        },
        duplicate: () => this.duplicateSelectedObject(),
        delete: () => this.deleteSelectedObject(),
        brush: () => this.toolManager.setActiveTool('brush'),
        eraser: () => this.toolManager.setActiveTool('eraser'),
        move: () => this.toolManager.setActiveTool('select'),
        blurBrush: () => this.activatePaintEffectBrush('blur'),
        pixelBrush: () => this.activatePaintEffectBrush('pixelate'),
        crop: () => this.startCropMode?.(),
        addRectangle: () => this.addRectangle(),
        addText: () => this.addText(),
        addRegion: () => this.startRegionInsertion(),
        brushSizeUp: () => this.adjustBrushSize(5),
        brushSizeDown: () => this.adjustBrushSize(-5),
        stepLeft: () => this.handleContextLeftShortcut(),
        stepRight: () => this.handleContextRightShortcut(),
        opacityDown: () => this.adjustSelectedObjectOpacity(-0.1),
        opacityUp: () => this.adjustSelectedObjectOpacity(0.1),
        nudgeLeft: () => this.nudgeSelectedObject(-10, 0),
        nudgeRight: () => this.nudgeSelectedObject(10, 0),
        nudgeDown: () => this.nudgeSelectedObject(0, 10),
        nudgeUp: () => this.nudgeSelectedObject(0, -10),
        customSubreddit: () => this.showCustomSubredditInput(),
      },
    });
    this.keyboardShortcuts.init();
  }

  initializeTheme() {
    this.themeManager.init(this.appShell);
  }

  initializeSettings() {
    const token = this.settings.getAccessToken();

    if (token) {
      this.canvasArea.refs.accessTokenInput.value = token;
    }

    this.canvasArea.refs.pasteAsLayerInput.checked = this.settings.getPasteImageAsLayer();
    this.settings.clearPointerCalibration();
  }

  async initializeAiEditPanel() {
    const savedState = this.settings.getAiEditSettings();
    const serviceId = savedState.serviceId || 'aiStudio';
    const sourceMode = savedState.sourceMode || 'visible-layers';
    const prompt = savedState.prompt || '';
    const serviceState = savedState.services?.[serviceId] ?? {};

    this.aiEditPanel.refs.serviceSelect.value = serviceId;
    this.aiEditPanel.refs.sourceSelect.value = sourceMode;
    this.aiEditPanel.refs.promptInput.value = prompt;
    this.aiEditPanel.refs.tokenInput.value = serviceState.token || '';
    this.aiEditPanel.refs.customUrlInput.value = serviceState.customUrl || '';

    this.updateAiEditServiceUi();
    await this.loadAiEditModels({
      preferredModel: serviceState.model || '',
      announceErrors: false,
    });
  }

  bindEvents() {
    this.bindThemeEvents();
    this.bindToolEvents();
    this.bindLayerPanelEvents();
    this.bindMaskEvents();
    this.bindBackgroundRemovalEvents();
    this.bindAiEditEvents();
    this.bindImageLoadingEvents();
    this.bindCanvasActions();
    this.bindViewportEvents();
    this.bindSessionEvents();
    this.bindSavedRoundEvents();
    this.bindSettingsEvents();
    this.bindShortcutEvents();
    this.bindAppEvents();
  }

  bindThemeEvents() {
    this.settingsButton.addEventListener('click', () => {
      this.openSettings('sessions');
    });

    this.settingsModal.refs.closeButton.addEventListener('click', () => {
      this.closeSettings();
    });

    this.settingsModal.refs.overlay.addEventListener('click', (event) => {
      if (event.target === this.settingsModal.refs.overlay) {
        this.closeSettings();
      }
    });

    this.settingsModal.refs.sessionsTabButton.addEventListener('click', () => {
      this.settingsModal.setActiveTab('sessions');
    });

    this.settingsModal.refs.themesTabButton.addEventListener('click', () => {
      this.settingsModal.setActiveTab('themes');
    });

    this.settingsModal.refs.shortcutsTabButton.addEventListener('click', () => {
      this.settingsModal.setActiveTab('shortcuts');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.settingsModal.refs.overlay.classList.contains('hidden')) {
        this.closeSettings();
      }
    });

    this.themePanel.refs.themeSelect.addEventListener('change', (event) => {
      this.themeManager.applyTheme(event.target.value);
      this.renderThemes();
      this.themePanel.setStatus('Theme applied.', 'success');
    });

    this.themePanel.refs.importButton.addEventListener('click', () => {
      this.themePanel.refs.importInput.click();
    });

    this.themePanel.refs.importInput.addEventListener('change', async (event) => {
      const [file] = event.target.files || [];

      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const themeDefinition = JSON.parse(text);
        const theme = this.themeManager.importTheme(
          themeDefinition,
          file.name.replace(/\.json$/i, '') || 'Imported theme'
        );
        this.renderThemes();
        this.themePanel.setStatus(`Theme "${theme.name}" imported.`, 'success');
      } catch {
        this.themePanel.setStatus('Could not import that theme JSON.', 'error');
      } finally {
        this.themePanel.refs.importInput.value = '';
      }
    });

    this.themePanel.refs.exportButton.addEventListener('click', () => {
      const theme = this.themeManager.getActiveTheme();
      const exportedTheme = this.themeManager.exportTheme(theme?.id);

      if (!theme || !exportedTheme) {
        this.themePanel.setStatus('No theme selected to export.', 'warning');
        return;
      }

      const blob = new Blob([JSON.stringify(exportedTheme, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}.imagemasker-theme.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.themePanel.setStatus('Theme exported.', 'success');
    });

    this.themePanel.refs.deleteButton.addEventListener('click', () => {
      const themeId = this.themePanel.refs.themeSelect.value;
      const theme = this.themeManager.getThemeById(themeId);

      if (!theme || theme.builtin) {
        this.themePanel.setStatus('Built-in themes cannot be deleted.', 'warning');
        return;
      }

      this.themeManager.deleteTheme(themeId);
      this.renderThemes();
      this.themePanel.setStatus(`Theme "${theme.name}" deleted.`, 'success');
    });

    this.githubButton.addEventListener('click', () => {
      window.open('https://github.com/ImageMasker/ImageMasker.github.io');
    });
  }

  bindToolEvents() {
    const refs = this.toolbar.refs;

    refs.brushButton.addEventListener('click', () => {
      this.toolManager.setActiveTool('brush');
    });

    refs.eraserButton.addEventListener('click', () => {
      this.toolManager.setActiveTool('eraser');
    });

    refs.blurBrushButton.addEventListener('click', () => {
      this.activatePaintEffectBrush('blur');
    });

    refs.pixelateBrushButton.addEventListener('click', () => {
      this.activatePaintEffectBrush('pixelate');
    });

    refs.moveButton.addEventListener('click', () => {
      this.toolManager.setActiveTool('select');
    });

    refs.cropButton.addEventListener('click', () => {
      this.startCropMode();
    });

    refs.applyCropButton.addEventListener('click', async () => {
      await this.applyCropFromTool();
    });

    refs.cancelCropButton.addEventListener('click', () => {
      this.cancelCropMode();
    });

    refs.addRectangleButton.addEventListener('click', () => {
      this.addRectangle();
    });

    refs.addRegionButton.addEventListener('click', () => {
      this.startRegionInsertion();
    });

    refs.duplicateButton.addEventListener('click', () => {
      this.duplicateSelectedObject();
    });

    refs.deleteButton.addEventListener('click', () => {
      this.deleteSelectedObject();
    });

    refs.brushSizeInput.addEventListener('input', (event) => {
      const width = Number(event.target.value);
      this.brushTool.setWidth(width);
      this.eraserTool.setWidth(width);
      this.blurPaintTool.setWidth(width);
      this.pixelatePaintTool.setWidth(width);
    });

    refs.brushColorInput.addEventListener('input', (event) => {
      this.brushTool.setColor(event.target.value);
    });

    refs.brushTypeSelect.addEventListener('change', (event) => {
      this.brushTool.setBrushType(event.target.value);
    });

    refs.brushOpacityInput.addEventListener('input', (event) => {
      const opacity = Number(event.target.value) / 100;
      this.brushTool.setOpacity(opacity);
      this.blurPaintTool.setOpacity(opacity);
      this.pixelatePaintTool.setOpacity(opacity);

      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer?.type === 'paint-effect') {
        this.paintEffectManager.updateLayerEffect(activeLayer.id, {
          opacity,
        });
      }
    });

    refs.paintEffectAmountInput.addEventListener('input', (event) => {
      const activeLayer = this.layerManager.getActiveLayer();

      if (activeLayer?.type === 'paint-effect') {
        this.paintEffectManager.updateLayerEffect(activeLayer.id, {
          amount: Number(event.target.value),
        });
        this.renderLayerPanel();
      }
    });

    refs.undoButton.addEventListener('click', () => {
      this.historyManager.undo();
    });

    refs.hueInput.addEventListener('input', (event) => {
      this.maskEffects.updateHue(event.target.value);
    });

    refs.invertButton.addEventListener('click', () => {
      const beforeState = this.maskEffects.snapshotCurrentMask();

      if (!beforeState) {
        return;
      }

      const isActive = !refs.invertButton.classList.contains('is-active');
      refs.invertButton.classList.toggle('is-active', isActive);
      this.maskEffects.setEffectEnabled('invert', isActive);
      this.commitMaskHistory('Toggle mask invert', beforeState);
    });

    refs.maskBlurButton.addEventListener('click', () => {
      const beforeState = this.maskEffects.snapshotCurrentMask();

      if (!beforeState) {
        return;
      }

      const isActive = !refs.maskBlurButton.classList.contains('is-active');
      refs.maskBlurButton.classList.toggle('is-active', isActive);

      if (isActive && Number(refs.maskBlurInput.value) === 0) {
        refs.maskBlurInput.value = '4';
      }

      this.maskEffects.updateEffect('blur', {
        enabled: isActive,
        strength: Number(refs.maskBlurInput.value),
      });
      this.commitMaskHistory('Toggle mask blur', beforeState);
    });

    refs.maskNoiseButton.addEventListener('click', () => {
      const beforeState = this.maskEffects.snapshotCurrentMask();

      if (!beforeState) {
        return;
      }

      const isActive = !refs.maskNoiseButton.classList.contains('is-active');
      refs.maskNoiseButton.classList.toggle('is-active', isActive);

      if (isActive && Number(refs.maskNoiseInput.value) === 0) {
        refs.maskNoiseInput.value = '12';
      }

      this.maskEffects.updateEffect('noiseWarp', {
        enabled: isActive,
        noise: Number(refs.maskNoiseInput.value) / 100,
      });
      this.commitMaskHistory('Toggle mask noise', beforeState);
    });

    refs.maskDisplacementButton.addEventListener('click', () => {
      const beforeState = this.maskEffects.snapshotCurrentMask();

      if (!beforeState) {
        return;
      }

      const isActive = !refs.maskDisplacementButton.classList.contains('is-active');
      refs.maskDisplacementButton.classList.toggle('is-active', isActive);

      if (isActive && Number(refs.maskDisplacementInput.value) === 0) {
        refs.maskDisplacementInput.value = '18';
      }

      this.maskEffects.updateEffect('displacement', {
        enabled: isActive,
        strength: Number(refs.maskDisplacementInput.value),
      });
      this.commitMaskHistory('Toggle mask warp', beforeState);
    });

    refs.maskDisplacementReseedButton.addEventListener('click', () => {
      const beforeState = this.maskEffects.snapshotCurrentMask();

      if (!beforeState) {
        return;
      }

      refs.maskDisplacementButton.classList.add('is-active');
      if (Number(refs.maskDisplacementInput.value) === 0) {
        refs.maskDisplacementInput.value = '18';
      }

      this.maskEffects.updateEffect('displacement', {
        enabled: true,
        strength: Number(refs.maskDisplacementInput.value),
        seed: Math.random(),
      });
      this.commitMaskHistory('Reseed mask warp', beforeState);
    });

    refs.addTextButton.addEventListener('click', () => {
      this.addText();
    });

    refs.textFontSelect.addEventListener('change', (event) => {
      this.applySelectedTextStyle({ fontFamily: event.target.value });
    });

    refs.textColorInput.addEventListener('input', (event) => {
      this.applySelectedTextStyle({ color: event.target.value });
    });

    refs.textOutlineColorInput.addEventListener('input', (event) => {
      this.applySelectedTextStyle({ stroke: event.target.value });
    });

    refs.textBoldButton.addEventListener('click', () => {
      const isActive = !refs.textBoldButton.classList.contains('is-active');
      refs.textBoldButton.classList.toggle('is-active', isActive);
      this.applySelectedTextStyle({ fontWeight: isActive ? '700' : '400' });
    });

    refs.textItalicButton.addEventListener('click', () => {
      const isActive = !refs.textItalicButton.classList.contains('is-active');
      refs.textItalicButton.classList.toggle('is-active', isActive);
      this.applySelectedTextStyle({ fontStyle: isActive ? 'italic' : 'normal' });
    });

    refs.textAlignSelect.addEventListener('change', (event) => {
      this.applySelectedTextStyle({ align: event.target.value });
    });

    refs.textShadowColorInput.addEventListener('input', (event) => {
      this.applySelectedTextStyle({ dropShadowColor: event.target.value });
    });

    refs.textShadowButton.addEventListener('click', () => {
      const isActive = !refs.textShadowButton.classList.contains('is-active');
      refs.textShadowButton.classList.toggle('is-active', isActive);
      this.applySelectedTextStyle({ dropShadow: isActive });
    });

    refs.regionShapeSelect.addEventListener('change', (event) => {
      this.applySelectedRegionShape(event.target.value);
    });

    refs.regionEffectSelect.addEventListener('change', (event) => {
      this.applySelectedRegionEffectType(event.target.value);
    });

    this.bindRegionEffectHistorySlider(refs.regionAmountInput, (event) => {
      this.applySelectedRegionEffectAmount(Number(event.target.value), false);
    });

    this.bindRegionEffectHistorySlider(refs.regionRadiusInput, (event) => {
      this.applySelectedRegionEffectRadius(Number(event.target.value), false);
    });

    this.bindRegionEffectHistorySlider(refs.regionMagnifyInput, (event) => {
      this.applySelectedRegionMagnify(Number(event.target.value) / 100, false);
    });

    this.bindRegionEffectHistorySlider(refs.regionContentRotationInput, (event) => {
      this.applySelectedRegionContentRotation(Number(event.target.value), false);
    });

    refs.regionReflectXButton.addEventListener('click', () => {
      this.toggleSelectedRegionReflection('reflectX');
    });

    refs.regionReflectYButton.addEventListener('click', () => {
      this.toggleSelectedRegionReflection('reflectY');
    });

    refs.regionReseedButton.addEventListener('click', () => {
      this.reseedSelectedRegionEffect();
    });

    this.bindTextHistorySlider(refs.textSizeInput, (event) => {
      this.applySelectedTextStyle({ fontSize: Number(event.target.value) }, false);
    });

    this.bindTextHistorySlider(refs.textOutlineWidthInput, (event) => {
      this.applySelectedTextStyle({ strokeThickness: Number(event.target.value) }, false);
    });

    this.bindTextHistorySlider(refs.textShadowBlurInput, (event) => {
      this.applySelectedTextStyle({ dropShadowBlur: Number(event.target.value) }, false);
    });

    this.bindTextHistorySlider(refs.textShadowDistanceInput, (event) => {
      this.applySelectedTextStyle({ dropShadowDistance: Number(event.target.value) }, false);
    });

    this.bindMaskHistorySlider(refs.alphaInput, (event) => {
      refs.alphaValue.textContent = event.target.value;
      this.maskEffects.updateOpacity(event.target.value);
    }, 'Update mask opacity');

    this.bindMaskHistorySlider(refs.zoomInput, (event) => {
      this.maskEffects.updateZoom(event.target.value);
    }, 'Update mask zoom');

    this.bindMaskHistorySlider(refs.angleInput, (event) => {
      this.maskEffects.rotateMask(event.target.value);
    }, 'Rotate mask');

    this.bindMaskHistorySlider(refs.hueInput, (event) => {
      this.maskEffects.updateHue(event.target.value);
    }, 'Update mask hue');

    this.bindMaskHistorySlider(refs.maskBlurInput, (event) => {
      const strength = Number(event.target.value);
      refs.maskBlurButton.classList.toggle('is-active', strength > 0);
      this.maskEffects.updateEffect('blur', {
        enabled: strength > 0,
        strength,
      });
    }, 'Update mask blur');

    this.bindMaskHistorySlider(refs.maskNoiseInput, (event) => {
      const noiseAmount = Number(event.target.value);
      refs.maskNoiseButton.classList.toggle('is-active', noiseAmount > 0);
      this.maskEffects.updateEffect('noiseWarp', {
        enabled: noiseAmount > 0,
        noise: noiseAmount / 100,
      });
    }, 'Update mask noise');

    this.bindMaskHistorySlider(refs.maskDisplacementInput, (event) => {
      const strength = Number(event.target.value);
      refs.maskDisplacementButton.classList.toggle('is-active', strength > 0);
      this.maskEffects.updateEffect('displacement', {
        enabled: strength > 0,
        strength,
      });
    }, 'Update mask warp');

    refs.alphaInput.addEventListener('input', (event) => {
      refs.alphaValue.textContent = event.target.value;
    });
  }

  bindLayerPanelEvents() {
    const finalizeOpacityChange = (slider) => {
      if (!slider) {
        return;
      }

      const beforeOpacity = slider.dataset.historyStart === undefined
        ? Number(slider.value) / 100
        : Number(slider.dataset.historyStart) / 100;
      const afterOpacity = Number(slider.value) / 100;

      this.commitLayerOpacityHistory(slider.dataset.layerId, beforeOpacity, afterOpacity);
      delete slider.dataset.historyStart;
    };

    const beginMaskSettingChange = (slider) => {
      if (!slider || slider.dataset.historySnapshot) {
        return;
      }

      const snapshot = this.snapshotMaskLayerState(slider.dataset.layerId);

      if (snapshot) {
        slider.dataset.historySnapshot = JSON.stringify(snapshot);
      }
    };

    const finalizeMaskSettingChange = (slider) => {
      if (!slider || !slider.dataset.historySnapshot) {
        return;
      }

      const beforeState = JSON.parse(slider.dataset.historySnapshot);
      const afterState = this.snapshotMaskLayerState(slider.dataset.layerId);

      delete slider.dataset.historySnapshot;

      if (!afterState) {
        return;
      }

      this.commitMaskLayerHistory(
        slider.dataset.layerId,
        beforeState,
        afterState,
        this.getMaskSettingHistoryLabel(slider.dataset.layerSetting)
      );
    };

    this.layerPanel.refs.list.addEventListener('pointerdown', (event) => {
      const slider = event.target.closest('.layer-opacity-slider');

      if (slider) {
        slider.dataset.historyStart = slider.value;
        return;
      }

      beginMaskSettingChange(event.target.closest('.layer-mask-slider'));
    });

    this.layerPanel.refs.list.addEventListener('pointerup', (event) => {
      finalizeOpacityChange(event.target.closest('.layer-opacity-slider'));
      finalizeMaskSettingChange(event.target.closest('.layer-mask-slider'));
    });

    this.layerPanel.refs.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-layer-action]');

      if (button) {
        event.stopPropagation();
        const { layerId, layerAction } = button.dataset;

        if (layerAction === 'toggle-visibility') {
          this.toggleLayerVisibility(layerId);
          return;
        }

        if (layerAction === 'toggle-lock') {
          this.toggleLayerLock(layerId);
          return;
        }

        if (layerAction === 'move-up') {
          this.moveLayer(layerId, 1);
          return;
        }

        if (layerAction === 'move-down') {
          this.moveLayer(layerId, -1);
          return;
        }

        if (layerAction === 'toggle-settings') {
          this.toggleLayerSettings(layerId);
          return;
        }

        if (layerAction === 'toggle-mask-invert') {
          this.toggleMaskLayerInvert(layerId);
          return;
        }

        if (layerAction === 'reseed-mask-displacement') {
          this.reseedMaskLayerDisplacement(layerId);
          return;
        }

        if (layerAction === 'delete') {
          this.deleteLayer(layerId);
        }
        return;
      }

      const row = event.target.closest('.layer-row');

      if (row && !event.target.closest('input, select, textarea, button')) {
        this.selectLayerById(row.dataset.layerId, {
          append: event.shiftKey,
        });
      }
    });

    this.layerPanel.refs.list.addEventListener('keydown', (event) => {
      const row = event.target.closest('.layer-row');

      if (!row || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }

      event.preventDefault();
      this.selectLayerById(row.dataset.layerId, {
        append: event.shiftKey,
      });
    });

    this.layerPanel.refs.list.addEventListener('focusin', (event) => {
      const opacitySlider = event.target.closest('.layer-opacity-slider');

      if (opacitySlider && !opacitySlider.dataset.historyStart) {
        opacitySlider.dataset.historyStart = opacitySlider.value;
        return;
      }

      beginMaskSettingChange(event.target.closest('.layer-mask-slider'));
    });

    this.layerPanel.refs.list.addEventListener('input', (event) => {
      const slider = event.target.closest('.layer-opacity-slider');

      if (slider) {
        const opacity = Number(slider.value) / 100;
        const value = slider.closest('.layer-opacity-control')?.querySelector('.layer-opacity-value');

        if (value) {
          value.textContent = `${slider.value}%`;
        }

        this.applyLayerOpacity(slider.dataset.layerId, opacity);
        return;
      }

      const maskSlider = event.target.closest('.layer-mask-slider');

      if (!maskSlider) {
        return;
      }

      const value = maskSlider.closest('.layer-setting-field')?.querySelector('.layer-setting-value');

      if (value) {
        value.textContent = this.formatLayerSettingValue(maskSlider.dataset.layerSetting, maskSlider.value);
      }

      this.applyMaskLayerSetting(maskSlider.dataset.layerId, maskSlider.dataset.layerSetting, maskSlider.value);
    });

    this.layerPanel.refs.list.addEventListener('focusout', (event) => {
      finalizeOpacityChange(event.target.closest('.layer-opacity-slider'));
      finalizeMaskSettingChange(event.target.closest('.layer-mask-slider'));
    });

    this.layerPanel.refs.list.addEventListener('change', (event) => {
      const opacitySlider = event.target.closest('.layer-opacity-slider');

      if (opacitySlider) {
        finalizeOpacityChange(opacitySlider);
        return;
      }

      const maskSlider = event.target.closest('.layer-mask-slider');

      if (maskSlider) {
        finalizeMaskSettingChange(maskSlider);
        return;
      }

      const input = event.target.closest('.layer-name-input');

      if (!input) {
        return;
      }

      this.renameLayer(input.dataset.layerId, input.value);
    });
  }

  bindMaskEvents() {
    this.maskPanel.refs.countrySelect.addEventListener('change', async (event) => {
      if (!event.target.value) {
        return;
      }

      await this.maskManager.loadMask(event.target.value, 75, 'country', 25, false);
    });

    this.maskPanel.refs.presetButtons.forEach((button) => {
      const maskId = Number(button.dataset.maskId);
      button.addEventListener('click', async () => {
        const preset = this.findPreset(maskId);
        await this.maskManager.loadMask(preset.full, preset.defaultAlpha, 'preset');
      });
    });

    this.maskPanel.refs.addMaskButton.addEventListener('click', () => {
      const url = this.maskPanel.refs.customMaskInput.value.trim();

      if (!url) {
        this.maskPanel.setMessage('Enter a mask URL first.', 'warning');
        this.maskPanel.refs.customMaskInput.focus();
        return;
      }

      this.maskStorage.addMask(url);
      this.maskPanel.appendCustomMask(url);
      this.bindCustomMaskButton(this.maskPanel.refs.customMaskList.lastElementChild);
      this.maskPanel.refs.customMaskInput.value = '';
      this.maskPanel.setMessage('Custom mask saved for reuse.', 'success');
      this.notify('Custom mask saved.', 'success');
    });

    this.maskPanel.refs.clearMasksButton.addEventListener('click', () => {
      this.maskStorage.clearAll();
      this.maskPanel.renderCustomMasks([]);
      this.maskPanel.setMessage('All custom masks were removed.', 'info');
      this.notify('Custom masks cleared.', 'success');
    });

    this.maskPanel.refs.customMaskInput.addEventListener('input', () => {
      this.maskPanel.setMessage('');
    });

    [...this.maskPanel.refs.customMaskList.children].forEach((button) => {
      this.bindCustomMaskButton(button);
    });
  }

  bindBackgroundRemovalEvents() {
    this.backgroundRemovalPanel.refs.button.addEventListener('click', async () => {
      await this.removeBackgroundFromCurrentTarget();
    });
  }

  bindAiEditEvents() {
    const refs = this.aiEditPanel.refs;

    refs.serviceSelect.addEventListener('change', async () => {
      const serviceState = this.getAiEditServiceState(refs.serviceSelect.value);

      refs.tokenInput.value = serviceState.token || '';
      refs.customUrlInput.value = serviceState.customUrl || '';
      this.updateAiEditServiceUi();
      this.persistAiEditSettings();
      await this.loadAiEditModels({
        preferredModel: serviceState.model || '',
      });
    });

    refs.sourceSelect.addEventListener('change', () => {
      this.persistAiEditSettings();
    });

    refs.promptInput.addEventListener('input', () => {
      this.aiEditPanel.setMessage('');
      this.persistAiEditSettings();
    });

    refs.tokenInput.addEventListener('change', async () => {
      this.persistAiEditSettings();

      if (refs.serviceSelect.value !== 'comfyUi') {
        await this.loadAiEditModels({
          preferredModel: this.getAiEditServiceState(refs.serviceSelect.value).model || refs.modelSelect.value,
          announceErrors: false,
        });
      }
    });

    refs.customUrlInput.addEventListener('change', async () => {
      this.persistAiEditSettings();

      if (refs.serviceSelect.value === 'comfyUi') {
        await this.loadAiEditModels({
          preferredModel: this.getAiEditServiceState(refs.serviceSelect.value).model || refs.modelSelect.value,
        });
      }
    });

    refs.modelSelect.addEventListener('change', () => {
      this.persistAiEditSettings();
    });

    refs.refreshModelsButton.addEventListener('click', async () => {
      await this.loadAiEditModels({
        preferredModel: refs.modelSelect.value,
      });
    });

    refs.generateButton.addEventListener('click', async () => {
      await this.generateAiEditedLayer();
    });
  }

  updateAiEditServiceUi() {
    const refs = this.aiEditPanel.refs;
    const serviceId = refs.serviceSelect.value;
    const definition = this.aiImageEditor.getServiceDefinition(serviceId);

    this.aiEditPanel.setServiceMeta(definition);
  }

  getAiEditSettings() {
    const stored = this.settings.getAiEditSettings();

    return stored && typeof stored === 'object'
      ? stored
      : {
          serviceId: 'aiStudio',
          sourceMode: 'visible-layers',
          prompt: '',
          services: {},
        };
  }

  getAiEditServiceState(serviceId) {
    const settings = this.getAiEditSettings();
    return settings.services?.[serviceId] ?? {};
  }

  persistAiEditSettings() {
    const refs = this.aiEditPanel.refs;
    const current = this.getAiEditSettings();
    const serviceId = refs.serviceSelect.value;
    const services = {
      ...(current.services ?? {}),
      [serviceId]: {
        ...(current.services?.[serviceId] ?? {}),
        token: refs.tokenInput.value.trim(),
        customUrl: refs.customUrlInput.value.trim(),
        model: refs.modelSelect.value,
      },
    };

    this.settings.setAiEditSettings({
      ...current,
      serviceId,
      sourceMode: refs.sourceSelect.value,
      prompt: refs.promptInput.value,
      services,
    });
  }

  async loadAiEditModels({ preferredModel = '', announceErrors = true } = {}) {
    const refs = this.aiEditPanel.refs;
    const serviceId = refs.serviceSelect.value;

    refs.refreshModelsButton.disabled = true;
    this.aiEditPanel.setMessage('');

    try {
      this.aiEditModels = await this.aiImageEditor.listModels({
        serviceId,
        token: refs.tokenInput.value.trim(),
        customUrl: refs.customUrlInput.value.trim(),
      });
      this.aiEditPanel.setModels(this.aiEditModels, preferredModel);
      this.persistAiEditSettings();
    } catch (error) {
      this.aiEditModels = [];
      this.aiEditPanel.setModels([], '');
      this.aiEditPanel.setMessage(error.message, 'error');

      if (announceErrors) {
        this.notify(error.message, 'error', 3600);
      }
    } finally {
      refs.refreshModelsButton.disabled = false;
    }
  }

  bindImageLoadingEvents() {
    const refs = this.canvasArea.refs;

    refs.dropOverlay.addEventListener('click', () => {
      refs.fileInput.click();
    });

    refs.fileInput.addEventListener('change', (event) => {
      const [file] = event.target.files || [];

      if (file) {
        this.loadLocalFile(file);
      }
    });

    refs.pasteAsLayerInput.addEventListener('change', () => {
      this.settings.setPasteImageAsLayer(refs.pasteAsLayerInput.checked);
    });

    refs.mobilePasteInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      await this.loadExternalImage(refs.mobilePasteInput.value);
    });

    refs.mobileRisInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      const url = refs.mobileRisInput.value.trim();

      if (!url) {
        this.notify('Paste an image URL to check RIS.', 'warning');
        return;
      }

      this.risChecker.check(url);
    });

    const activateDropState = (event) => {
      event.preventDefault();
      refs.dropOverlay.classList.add('is-drag-over');
    };

    const clearDropState = () => {
      refs.dropOverlay.classList.remove('is-drag-over');
    };

    const handleDrop = (event) => {
      event.preventDefault();
      clearDropState();

      const [file] = event.dataTransfer?.files || [];
      if (file) {
        this.loadLocalFile(file);
      }
    };

    this.appShell.addEventListener('dragover', activateDropState);
    this.appShell.addEventListener('dragleave', clearDropState);
    this.appShell.addEventListener('drop', handleDrop);
    document.addEventListener('paste', (event) => {
      this.handlePaste(event);
    });
  }

  bindCanvasActions() {
    const refs = this.canvasArea.refs;

    refs.uploadButton.addEventListener('click', async () => {
      await this.uploadToImgur();
    });

    refs.copyUrlButton.addEventListener('click', async () => {
      if (!refs.uploadedUrl.value.trim()) {
        this.notify('There is no uploaded URL to copy yet.', 'warning');
        return;
      }

      await this.copyText(refs.uploadedUrl.value, 'Image URL copied.');
    });

    refs.checkRisButton.addEventListener('click', () => {
      if (!refs.uploadedUrl.value.trim()) {
        this.notify('Upload an image first to check RIS.', 'warning');
        return;
      }

      this.risChecker.check(refs.uploadedUrl.value);
    });

    refs.postRedditButton.addEventListener('click', async () => {
      if (!refs.uploadedUrl.value.trim()) {
        this.notify('Upload an image first before posting to Reddit.', 'warning');
        return;
      }

      try {
        await this.redditPoster.postToReddit(
          refs.uploadedUrl.value,
          refs.roundTitle.value,
          refs.subredditInput.value || 'picturegame'
        );
        this.notify('Opened Reddit submission page.', 'success');
      } catch (error) {
        this.notify('Could not open Reddit submission flow.', 'error');
      }
    });

    refs.subredditInput.addEventListener('input', () => {
      this.updatePostRedditButtonLabel();
    });

    refs.copyImageButton.addEventListener('click', async () => {
      await this.copyImage();
    });

    refs.downloadButton.addEventListener('click', async () => {
      await this.downloadImage();
    });

    refs.saveButton.addEventListener('click', () => {
      this.saveRoundFromEditor();
    });

    refs.exportButton.addEventListener('click', async () => {
      await this.copyYml({
        roundTitle: refs.roundTitle.value,
        roundAnswer: refs.roundAnswer.value,
        imageUrl: refs.uploadedUrl.value,
      });
    });

    refs.exportPresetSelect.addEventListener('change', () => {
      this.syncExportControlsFromPreset();
    });

    refs.exportFormatSelect.addEventListener('change', () => {
      this.updateExportQualityUi();
    });

    refs.exportQualityInput.addEventListener('input', (event) => {
      refs.exportQualityValue.textContent = `${event.target.value}%`;
    });
  }

  bindViewportEvents() {
    const refs = this.canvasArea.refs;

    refs.zoomInButton.addEventListener('click', () => {
      this.viewportController.zoomIn();
    });

    refs.zoomOutButton.addEventListener('click', () => {
      this.viewportController.zoomOut();
    });

    refs.fitViewButton.addEventListener('click', () => {
      this.viewportController.fitToScreen();
    });

    refs.actualSizeButton.addEventListener('click', () => {
      this.viewportController.setActualSize();
    });
  }

  bindSavedRoundEvents() {
    this.savedRoundsController.bindEvents();
  }

  bindSessionEvents() {
    this.sessionController.bindEvents();
  }

  bindSettingsEvents() {
    const refs = this.canvasArea.refs;

    refs.accessTokenSubmit.addEventListener('click', () => {
      const token = refs.accessTokenInput.value.trim();
      this.settings.setAccessToken(token);
      refs.accessTokenInput.value = '';
      refs.accessTokenInput.placeholder = 'Access token saved';
      this.notify('Imgur access token saved.', 'success');
    });

    refs.accessTokenDelete.addEventListener('click', () => {
      this.settings.deleteAccessToken();
      refs.accessTokenInput.value = '';
      refs.accessTokenInput.placeholder = 'Access token deleted';
      this.notify('Imgur access token deleted.', 'success');
    });
  }

  bindAppEvents() {
    this.eventBus.on('image:loaded', () => {
      this.applyImageLoadedUiState();
      this.renderLayerPanel();
      this.updateWorkflowStatus();
      this.queueAutosave();
    });

    this.eventBus.on('layer:added', () => {
      this.renderLayerPanel();
      this.queueAutosave();
    });

    this.eventBus.on('layer:removed', ({ layer }) => {
      this.expandedLayerSettings.delete(layer?.id);

      if (this.maskManager.clearCurrentMaskReference(layer?.id)) {
        this.syncMaskControlsFromState();
      }

      this.renderLayerPanel();
      this.queueAutosave();
    });

    this.eventBus.on('layer:reordered', () => {
      this.renderLayerPanel();
      this.queueAutosave();
    });

    this.eventBus.on('layer:updated', ({ field } = {}) => {
      if (field === 'opacity') {
        return;
      }

      this.renderLayerPanel();
      this.queueAutosave();
    });

    this.eventBus.on('layer:active-changed', () => {
      this.renderLayerPanel();
    });

    this.eventBus.on('selection:changed', ({ layer, object }) => {
      this.selectedPanelLayerId = null;
      const primaryObject = layer ? this.layerManager.getPrimaryContentObject(layer) ?? object : object;

      if (layer?.type === 'mask' && primaryObject?.__toolType === 'mask') {
        this.maskManager.setCurrentMask(primaryObject, layer);
        this.syncMaskControlsFromState(this.maskEffects.snapshotCurrentMask());
      }

      this.renderLayerPanel();
      this.syncTextControlsFromSelection(primaryObject ?? null);
      this.syncRegionEffectControlsFromSelection(primaryObject ?? null);
      this.updateWorkflowStatus();
    });

    this.eventBus.on('stroke:committed', ({ stroke }) => {
      const strokeIndex = this.brushTool.getLayerStrokes(stroke.layerId).indexOf(stroke);

      this.historyManager.pushExecuted({
        label: 'Draw stroke',
        undo: () => {
          this.brushTool.removeStroke(stroke);
        },
        redo: () => {
          this.brushTool.addStroke(stroke, strokeIndex);
        },
      });
      this.queueAutosave();
    });

    this.eventBus.on('text:edited', ({ object, beforeText, afterText }) => {
      this.historyManager.pushExecuted({
        label: 'Edit text',
        undo: () => {
          object.text = beforeText;
          this.eventBus.emit('object:changed', { object });
        },
        redo: () => {
          object.text = afterText;
          this.eventBus.emit('object:changed', { object });
        },
      });
      this.queueAutosave();
    });

    this.eventBus.on('object:transformed', ({ beforeState, afterState, applyState }) => {
      this.historyManager.pushExecuted({
        label: 'Transform object',
        undo: () => applyState(beforeState),
        redo: () => applyState(afterState),
      });
      this.queueAutosave();
    });

    this.eventBus.on('objects:transformed', ({ entries }) => {
      if (!entries?.length) {
        return;
      }

      this.historyManager.pushExecuted({
        label: 'Transform selection',
        undo: () => {
          for (const entry of entries) {
            applyObjectState(entry.object, entry.beforeState);
            this.eventBus.emit('object:changed', {
              object: entry.object,
            });
          }
        },
        redo: () => {
          for (const entry of entries) {
            applyObjectState(entry.object, entry.afterState);
            this.eventBus.emit('object:changed', {
              object: entry.object,
            });
          }
        },
      });
      this.queueAutosave();
    });

    this.eventBus.on('tool:changed', ({ name }) => {
      this.toolbar.refs.brushButton.classList.toggle('is-active', name === 'brush');
      this.toolbar.refs.eraserButton.classList.toggle('is-active', name === 'eraser');
      this.toolbar.refs.blurBrushButton.classList.toggle('is-active', name === 'blur-brush');
      this.toolbar.refs.pixelateBrushButton.classList.toggle('is-active', name === 'pixelate-brush');
      this.toolbar.refs.moveButton.classList.toggle('is-active', name === 'select');
      this.toolbar.refs.cropButton.classList.toggle('is-active', name === 'crop');
      this.toolbar.refs.addRegionButton.classList.toggle('is-active', name === 'region');
      this.toolbar.refs.paintEffectAmountField.hidden = !['blur-brush', 'pixelate-brush'].includes(name);
      this.toolbar.refs.cropActionRow.hidden = name !== 'crop';
      if (['blur-brush', 'pixelate-brush'].includes(name)) {
        this.syncPaintEffectControls();
      }
      this.renderLayerPanel();
      this.updateWorkflowStatus();
    });

    this.eventBus.on('region:created', ({ layer, object }) => {
      this.toolManager.setActiveTool('select');
      this.selectTool.selectLayer(layer, object);
      this.recordLayerAdded(layer);
      this.syncRegionEffectControlsFromSelection(object);
    });

    this.eventBus.on('mask:loaded', () => {
      this.renderLayerPanel();
      this.syncMaskControlsFromState(this.maskEffects.snapshotCurrentMask());
      this.updateWorkflowStatus();
      this.queueAutosave();
    });

    this.eventBus.on('viewport:changed', ({ scale }) => {
      this.canvasArea.refs.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    });
  }

  bindCustomMaskButton(button) {
    if (!button) {
      return;
    }

    button.addEventListener('click', async () => {
      const url = button.dataset.customMaskUrl;
      await this.maskManager.loadMask(url, 60, 'custom');
    });
  }

  findPreset(maskId) {
    return PRESET_MASKS.find((mask) => mask.id === maskId) ?? null;
  }

  hideIntroButtons() {
    this.uiStateController.hideIntroButtons();
  }

  applyImageLoadedUiState() {
    this.uiStateController.applyImageLoadedUiState();
  }

  updatePostRedditButtonLabel() {
    this.uiStateController.updatePostRedditButtonLabel();
  }

  applyRestoredSessionUiState() {
    this.uiStateController.applyRestoredSessionUiState();
  }

  showCustomSubredditInput() {
    this.uiStateController.showCustomSubredditInput();
  }

  openSettings(tab = 'sessions') {
    this.settingsModal.setActiveTab(tab);
    this.settingsModal.setOpen(true);
  }

  closeSettings() {
    this.settingsModal.setOpen(false);
  }

  notify(message, tone = 'info', duration = 2400) {
    this.toastManager?.show(message, tone, duration);
  }

  updateWorkflowStatus() {
    this.uiStateController.updateWorkflowStatus();
  }

  renderThemes() {
    const themes = this.themeManager.getThemes();
    const activeTheme = this.themeManager.getActiveTheme();

    this.themePanel.renderThemes(themes, activeTheme.id);
    this.themePanel.setSummary(this.themeManager.describeTheme(activeTheme.id));
    this.themePanel.refs.deleteButton.disabled = activeTheme.builtin;
  }

  renderShortcuts() {
    const commands = this.keyboardShortcuts?.getCommands?.() ?? [];

    this.shortcutsPanel.renderCommands(commands, (binding) => this.keyboardShortcuts.formatBinding(binding));
    this.updateShortcutLabels();
  }

  bindShortcutEvents() {
    let activeCaptureCommandId = '';

    this.shortcutsPanel.refs.resetButton.addEventListener('click', () => {
      this.keyboardShortcuts.resetAllBindings();
      this.shortcutsPanel.setCapture('');
      this.shortcutsPanel.setMessage('Shortcuts reset to defaults.', 'success');
      activeCaptureCommandId = '';
      this.renderShortcuts();
    });

    this.shortcutsPanel.refs.list.addEventListener('click', (event) => {
      const captureButton = event.target.closest('[data-shortcut-command]');
      const resetButton = event.target.closest('[data-shortcut-reset]');

      if (captureButton) {
        activeCaptureCommandId = captureButton.dataset.shortcutCommand;
        this.shortcutsPanel.setCapture(activeCaptureCommandId);
        this.shortcutsPanel.setMessage('Press the new shortcut.', 'info');
        this.renderShortcuts();
        return;
      }

      if (resetButton) {
        this.keyboardShortcuts.resetBinding(resetButton.dataset.shortcutReset);
        this.shortcutsPanel.setMessage('Shortcut reset.', 'success');
        this.renderShortcuts();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!activeCaptureCommandId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        activeCaptureCommandId = '';
        this.shortcutsPanel.setCapture('');
        this.shortcutsPanel.setMessage('Shortcut capture cancelled.', 'info');
        this.renderShortcuts();
        return;
      }

      const binding = this.keyboardShortcuts.eventToBinding(event);

      if (!binding) {
        return;
      }

      const result = this.keyboardShortcuts.setBinding(activeCaptureCommandId, binding);
      activeCaptureCommandId = '';
      this.shortcutsPanel.setCapture('');
      this.shortcutsPanel.setMessage(result.message, result.ok ? 'success' : 'warning');
      this.renderShortcuts();
    }, true);
  }

  updateShortcutLabels() {
    const buttonBindings = new Map([
      [this.toolbar.refs.brushButton, this.keyboardShortcuts.getBinding('brush')],
      [this.toolbar.refs.eraserButton, this.keyboardShortcuts.getBinding('eraser')],
      [this.toolbar.refs.moveButton, this.keyboardShortcuts.getBinding('move')],
      [this.toolbar.refs.blurBrushButton, this.keyboardShortcuts.getBinding('blurBrush')],
      [this.toolbar.refs.pixelateBrushButton, this.keyboardShortcuts.getBinding('pixelBrush')],
      [this.toolbar.refs.cropButton, this.keyboardShortcuts.getBinding('crop')],
      [this.toolbar.refs.addRectangleButton, this.keyboardShortcuts.getBinding('addRectangle')],
      [this.toolbar.refs.addTextButton, this.keyboardShortcuts.getBinding('addText')],
      [this.toolbar.refs.addRegionButton, this.keyboardShortcuts.getBinding('addRegion')],
      [this.toolbar.refs.duplicateButton, this.keyboardShortcuts.getBinding('duplicate')],
      [this.toolbar.refs.deleteButton, this.keyboardShortcuts.getBinding('delete')],
      [this.toolbar.refs.undoButton, this.keyboardShortcuts.getBinding('undo')],
      [this.canvasArea.refs.copyImageButton, this.keyboardShortcuts.getBinding('copyCanvas')],
    ]);

    for (const [button, binding] of buttonBindings.entries()) {
      if (!button) {
        continue;
      }

      const baseLabel = button.dataset.shortcutLabel || button.textContent || '';
      const formattedBinding = this.keyboardShortcuts.formatBinding(binding);
      const labelHtml = this.formatShortcutLabel(baseLabel, binding);
      button.innerHTML = `${labelHtml}<span class="shortcut-badge">${formattedBinding}</span>`;
    }
  }

  formatShortcutLabel(label, binding) {
    const plainBinding = typeof binding === 'string' && /^[A-Z0-9]$/.test(binding) ? binding : '';

    if (!plainBinding) {
      return `<span class="shortcut-label-text">${label}</span>`;
    }

    const index = label.toUpperCase().indexOf(plainBinding);

    if (index === -1) {
      return `<span class="shortcut-label-text">${label}</span>`;
    }

    const before = label.slice(0, index);
    const match = label.slice(index, index + 1);
    const after = label.slice(index + 1);

    return `<span class="shortcut-label-text">${before}<u>${match}</u>${after}</span>`;
  }

  flashButtonSuccess(button, text = 'Saved!', duration = 1600) {
    if (!button) {
      return;
    }

    window.clearTimeout(button.__resetTimeoutId);

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }

    button.textContent = text;
    button.classList.add('is-success');
    button.__resetTimeoutId = window.setTimeout(() => {
      button.textContent = button.dataset.defaultText;
      button.classList.remove('is-success');
    }, duration);
  }

  syncExportControlsFromPreset() {
    const refs = this.canvasArea.refs;
    const preset = this.exportManager.getPreset(refs.exportPresetSelect.value);

    refs.exportFormatSelect.value = preset.format;
    refs.exportSizeSelect.value = preset.size;
    refs.exportQualityInput.value = String(Math.round(preset.quality * 100));
    refs.exportQualityValue.textContent = `${refs.exportQualityInput.value}%`;
    this.updateExportQualityUi();
  }

  updateExportQualityUi() {
    const refs = this.canvasArea.refs;
    const isJpeg = refs.exportFormatSelect.value === 'jpeg';

    refs.exportQualityInput.classList.toggle('hidden', !isJpeg);
    refs.exportQualityValue.classList.toggle('hidden', !isJpeg);
  }

  renderSessions() {
    this.sessionController.renderSessions();
  }

  updateSessionStatus(session = null) {
    this.sessionController.updateSessionStatus(session);
  }

  maybeShowRestorePrompt() {
    this.sessionController.maybeShowRestorePrompt();
  }

  setBackgroundSource(source) {
    this.currentBackgroundSource = source
      ? {
          ...source,
          visible: source.visible !== false,
          opacity: Number.isFinite(Number(source.opacity)) ? Number(source.opacity) : 1,
        }
      : null;

    if (this.canvasEngine?.backgroundSprite && this.currentBackgroundSource) {
      this.canvasEngine.backgroundSprite.visible = this.currentBackgroundSource.visible !== false;
      this.canvasEngine.backgroundSprite.alpha = this.currentBackgroundSource.opacity;
    }
  }

  setBackgroundVisibility(visible) {
    if (!this.canvasEngine?.backgroundSprite) {
      return;
    }

    const nextVisible = visible !== false;
    this.canvasEngine.backgroundSprite.visible = nextVisible;

    if (this.currentBackgroundSource) {
      this.currentBackgroundSource.visible = nextVisible;
    }
  }

  serializeCurrentSession() {
    return this.sessionSerializer.serialize(this);
  }

  createSceneSnapshot({ forceEmbeddedBackground = false } = {}) {
    const document = this.serializeCurrentSession();

    if (!document) {
      return null;
    }

    if ((forceEmbeddedBackground || !document.canRestore) && this.canvasEngine.sourceImageElement) {
      const fullRect = {
        x: 0,
        y: 0,
        width: this.canvasEngine.canvasWidth,
        height: this.canvasEngine.canvasHeight,
      };
      const dataUrl = this.cropElementToDataUrl(this.canvasEngine.sourceImageElement, fullRect);
      document.background.embeddedDataUrl = dataUrl;
      document.background.url = document.background.url || dataUrl;
      document.canRestore = true;
    }

    return document;
  }

  async applySceneSnapshot(document) {
    if (!document) {
      return false;
    }

    this.isRestoringSession = true;

    try {
      await this.sessionSerializer.restore(this, document);
      this.syncExportControlsFromPreset();
      this.renderLayerPanel();
      this.queueAutosave();
      return true;
    } finally {
      this.isRestoringSession = false;
    }
  }

  queueAutosave() {
    if (this.isRestoringSession) {
      return;
    }

    window.clearTimeout(this.autosaveTimeoutId);
    this.autosaveTimeoutId = window.setTimeout(() => {
      this.persistAutosave();
    }, 600);
  }

  persistAutosave() {
    const document = this.serializeCurrentSession();

    if (!document) {
      this.sessionStorage.clearAutosave();
      this.updateSessionStatus(this.sessionStorage.getSession(this.selectedSessionId));
      return;
    }

    this.sessionStorage.setAutosave(document);
    this.updateSessionStatus(this.sessionStorage.getSession(this.selectedSessionId));
  }

  async clearEditorScene() {
    this.selectTool.clearSelection();
    this.brushTool.clear();

    const layers = this.layerManager
      .getLayers()
      .filter((layer) => layer.type !== 'drawing');

    for (const layer of [...layers].reverse()) {
      this.layerManager.removeLayer(layer.id);
    }

    this.maskManager.clearCurrentMaskReference();
    this.canvasArea.refs.uploadedUrl.value = '';
    this.canvasArea.refs.roundTitle.value = '';
    this.canvasArea.refs.roundAnswer.value = '';
    this.canvasArea.refs.subredditInput.value = 'picturegame';
  }

  saveCurrentSession() {
    this.sessionController.saveCurrentSession();
  }

  async loadSelectedSession() {
    return this.sessionController.loadSelectedSession();
  }

  duplicateSelectedSession() {
    this.sessionController.duplicateSelectedSession();
  }

  deleteSelectedSession() {
    this.sessionController.deleteSelectedSession();
  }

  async exportCurrentSessionJson() {
    return this.sessionController.exportCurrentSessionJson();
  }

  async restoreSessionDocument(document) {
    return this.sessionController.restoreSessionDocument(document);
  }

  getCurrentExportOptions() {
    const refs = this.canvasArea.refs;

    return this.exportManager.resolveOptions({
      presetId: refs.exportPresetSelect.value,
      format: refs.exportFormatSelect.value,
      size: refs.exportSizeSelect.value,
      quality: Number(refs.exportQualityInput.value) / 100,
    });
  }

  bindMaskHistorySlider(input, onInput, label) {
    input.addEventListener('pointerdown', () => {
      const snapshot = this.maskEffects.snapshotCurrentMask();
      input.__historyStart = snapshot ? JSON.stringify(snapshot) : '';
    });

    input.addEventListener('input', onInput);
    input.addEventListener('change', () => {
      const beforeState = input.__historyStart ? JSON.parse(input.__historyStart) : null;
      this.commitMaskHistory(label, beforeState);
      input.__historyStart = '';
    });
  }

  bindTextHistorySlider(input, onInput) {
    input.addEventListener('pointerdown', () => {
      const textObject = this.getSelectedTextObject();
      input.__historyStart = textObject ? JSON.stringify(textObject.__textData) : '';
    });

    input.addEventListener('input', onInput);
    input.addEventListener('change', () => {
      const textObject = this.getSelectedTextObject();

      if (!textObject || !input.__historyStart) {
        input.__historyStart = '';
        return;
      }

      const beforeMeta = JSON.parse(input.__historyStart);
      this.commitTextStyleHistory(textObject, beforeMeta);
      input.__historyStart = '';
    });
  }

  bindRegionEffectHistorySlider(input, onInput) {
    input.addEventListener('pointerdown', () => {
      const object = this.getSelectedRegionEffectObject();
      input.__historyStart = object ? JSON.stringify(object.__regionEffectData) : '';
    });

    input.addEventListener('input', onInput);
    input.addEventListener('change', () => {
      const object = this.getSelectedRegionEffectObject();

      if (!object || !input.__historyStart) {
        input.__historyStart = '';
        return;
      }

      const beforeData = JSON.parse(input.__historyStart);
      this.commitRegionEffectHistory(object, beforeData);
      input.__historyStart = '';
    });
  }

  commitMaskHistory(label, beforeState) {
    if (!beforeState) {
      return;
    }

    const afterState = this.maskEffects.snapshotCurrentMask();

    if (!afterState || JSON.stringify(beforeState) === JSON.stringify(afterState)) {
      return;
    }

    this.historyManager.pushExecuted({
      label,
      undo: () => {
        this.maskEffects.restoreCurrentMask(beforeState);
        this.syncMaskControlsFromState(beforeState);
      },
      redo: () => {
        this.maskEffects.restoreCurrentMask(afterState);
        this.syncMaskControlsFromState(afterState);
      },
    });
    this.queueAutosave();
  }

  syncMaskControlsFromState(state = null) {
    const refs = this.toolbar.refs;
    const effects = new Map((state?.effects ?? []).map((effect) => [effect.type, effect]));
    const hueEffect = effects.get('hue');
    const invertEffect = effects.get('invert');
    const blurEffect = effects.get('blur');
    const noiseEffect = effects.get('noiseWarp');
    const displacementEffect = effects.get('displacement');

    refs.alphaInput.value = String(Math.round((state?.alpha ?? 0.75) * 100));
    refs.alphaValue.textContent = refs.alphaInput.value;
    refs.zoomInput.value = String(state?.zoomValue ?? 50);
    refs.angleInput.value = String(this.normalizeAngleDegrees((state?.rotation ?? 0) * (180 / Math.PI)));
    refs.hueInput.value = String(hueEffect?.value ?? state?.hueValue ?? 0);
    refs.invertButton.classList.toggle('is-active', Boolean(invertEffect?.enabled ?? state?.invertEnabled));
    refs.maskBlurInput.value = String(Math.round(blurEffect?.strength ?? 0));
    refs.maskBlurButton.classList.toggle('is-active', Boolean(blurEffect?.enabled && (blurEffect?.strength ?? 0) > 0));
    refs.maskNoiseInput.value = String(Math.round((noiseEffect?.noise ?? 0) * 100));
    refs.maskNoiseButton.classList.toggle('is-active', Boolean(noiseEffect?.enabled && (noiseEffect?.noise ?? 0) > 0));
    refs.maskDisplacementInput.value = String(Math.round(displacementEffect?.strength ?? 0));
    refs.maskDisplacementButton.classList.toggle('is-active', Boolean(displacementEffect?.enabled && (displacementEffect?.strength ?? 0) > 0));
  }

  addRectangle() {
    const refs = this.toolbar.refs;
    const result = this.rectTool.addRectangle({
      color: refs.brushColorInput.value,
      opacity: Number(refs.brushOpacityInput.value) / 100,
      blendMode: 'normal',
    });

    this.toolManager.setActiveTool('select');
    this.selectTool.selectLayer(result.layer, result.object);
    this.recordLayerAdded(result.layer);
  }

  activatePaintEffectBrush(effectType) {
    const amount = Number(this.toolbar.refs.paintEffectAmountInput.value);
    const opacity = Number(this.toolbar.refs.brushOpacityInput.value) / 100;
    const layer = this.paintEffectManager.ensureActiveEffectLayer(effectType, {
      amount,
      opacity,
    });

    this.layerManager.setActiveLayer(layer.id);
    this.selectTool.selectLayer(layer, this.selectTool.getPrimaryLayerObject(layer));
    this.toolManager.setActiveTool(effectType === 'pixelate' ? 'pixelate-brush' : 'blur-brush');
    this.syncPaintEffectControls();
  }

  syncPaintEffectControls() {
    const activeLayer = this.layerManager.getActiveLayer();
    const effect = activeLayer?.paintEffect ?? null;

    if (!effect) {
      this.toolbar.refs.paintEffectAmountInput.value = '12';
      return;
    }

    this.toolbar.refs.paintEffectAmountInput.value = String(Math.round(effect.amount ?? 12));
    this.toolbar.refs.brushOpacityInput.value = String(Math.round((effect.opacity ?? 1) * 100));
  }

  adjustBrushSize(delta) {
    const input = this.toolbar.refs.brushSizeInput;
    const nextWidth = Math.max(1, Math.min(50, Number(input.value) + delta));
    input.value = String(nextWidth);
    this.brushTool.setWidth(nextWidth);
    this.eraserTool.setWidth(nextWidth);
    this.blurPaintTool.setWidth(nextWidth);
    this.pixelatePaintTool.setWidth(nextWidth);
  }

  handleContextLeftShortcut() {
    if (this.savedRoundsPanel.refs.savedRounds && !this.savedRoundsPanel.refs.savedRounds.classList.contains('hidden')) {
      this.displaySavedRounds(1);
      return;
    }

    this.adjustMaskRotationByDelta(-2);
  }

  handleContextRightShortcut() {
    if (this.savedRoundsPanel.refs.savedRounds && !this.savedRoundsPanel.refs.savedRounds.classList.contains('hidden')) {
      this.displaySavedRounds(2);
      return;
    }

    this.adjustMaskRotationByDelta(2);
  }

  startCropMode() {
    if (!this.canvasEngine.sourceImageElement) {
      this.notify('Load an image before resizing the canvas.', 'warning');
      return;
    }

    this.toolManager.setActiveTool('crop');
    this.toolbar.refs.cropActionRow.hidden = false;
  }

  cancelCropMode() {
    this.toolbar.refs.cropActionRow.hidden = true;
    this.toolManager.setActiveTool('select');
  }

  async applyCropFromTool() {
    const cropRect = this.cropTool.getCropRect();

    if (!cropRect) {
      return;
    }

    const beforeDocument = this.createSceneSnapshot({
      forceEmbeddedBackground: true,
    });
    await this.performDestructiveCrop(cropRect);
    const afterDocument = this.createSceneSnapshot({
      forceEmbeddedBackground: true,
    });

    this.cancelCropMode();

    if (!beforeDocument || !afterDocument) {
      return;
    }

    this.historyManager.pushExecuted({
      label: 'Resize canvas',
      undo: () => {
        void this.applySceneSnapshot(beforeDocument);
      },
      redo: () => {
        void this.applySceneSnapshot(afterDocument);
      },
    });
    this.queueAutosave();
  }

  async performDestructiveCrop(rect) {
    const resizeRect = this.normalizeCanvasResizeRect(rect);
    const backgroundDataUrl = this.cropElementToDataUrl(this.canvasEngine.sourceImageElement, resizeRect);
    const backgroundVisible = this.canvasEngine.backgroundSprite?.visible !== false;
    const backgroundOpacity = this.canvasEngine.backgroundSprite?.alpha ?? 1;

    const allLayers = this.layerManager.getLayers();

    for (const layer of allLayers) {
      layer.container.position.set(
        (layer.container.x ?? 0) - resizeRect.x,
        (layer.container.y ?? 0) - resizeRect.y
      );
    }

    await this.canvasEngine.loadBackgroundImage(backgroundDataUrl, false, {
      preserveScene: true,
      documentSize: {
        width: resizeRect.width,
        height: resizeRect.height,
      },
    });
    this.setBackgroundSource({
      type: 'local',
      url: backgroundDataUrl,
      embeddedDataUrl: backgroundDataUrl,
      visible: backgroundVisible,
      opacity: backgroundOpacity,
      cropped: true,
    });
    this.renderLayerPanel();
  }

  cropElementToDataUrl(source, rect) {
    const sourceWidth = source?.naturalWidth || source?.videoWidth || source?.width || this.canvasEngine.canvasWidth;
    const sourceHeight = source?.naturalHeight || source?.videoHeight || source?.height || this.canvasEngine.canvasHeight;
    const scaleX = sourceWidth / this.canvasEngine.canvasWidth;
    const scaleY = sourceHeight / this.canvasEngine.canvasHeight;
    const sourceRect = {
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      width: Math.max(1, Math.round(rect.width * scaleX)),
      height: Math.max(1, Math.round(rect.height * scaleY)),
    };
    const canvas = document.createElement('canvas');
    canvas.width = sourceRect.width;
    canvas.height = sourceRect.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not crop the current image.');
    }

    context.drawImage(
      source,
      -sourceRect.x,
      -sourceRect.y,
      Math.max(1, Math.round(this.canvasEngine.canvasWidth * scaleX)),
      Math.max(1, Math.round(this.canvasEngine.canvasHeight * scaleY))
    );

    return canvas.toDataURL('image/png');
  }

  normalizeCanvasResizeRect(rect) {
    return {
      x: Math.round(Number(rect?.x) || 0),
      y: Math.round(Number(rect?.y) || 0),
      width: Math.max(1, Math.round(Number(rect?.width) || 0)),
      height: Math.max(1, Math.round(Number(rect?.height) || 0)),
    };
  }

  startRegionInsertion() {
    if (!this.canvasEngine.sourceImageElement) {
      this.notify('Load an image before adding a region.', 'warning');
      return;
    }

    this.syncRegionCreationOptionsFromToolbar();
    this.toolManager.setActiveTool('region');
  }

  addText() {
    const refs = this.toolbar.refs;
    const result = this.textTool.addText({
      ...this.buildTextMetaFromToolbar(),
    });

    this.toolManager.setActiveTool('select');
    this.selectTool.selectLayer(result.layer, result.object);
    this.recordLayerAdded(result.layer);
  }

  getSelectedTextObject() {
    const layer = this.selectTool.getSelectedLayer();
    const object = layer ? this.layerManager.getPrimaryContentObject(layer) : this.selectTool.getSelectedObject();
    return object?.__toolType === 'text' ? object : null;
  }

  getSelectedRegionEffectObject() {
    const layer = this.selectTool.getSelectedLayer();
    const object = layer ? this.layerManager.getPrimaryContentObject(layer) : this.selectTool.getSelectedObject();
    return object?.__toolType === 'effect-region' ? object : null;
  }

  buildTextMetaFromToolbar() {
    const refs = this.toolbar.refs;

    return {
      color: refs.textColorInput.value,
      fontSize: Number(refs.textSizeInput.value),
      fontFamily: refs.textFontSelect.value,
      fontWeight: refs.textBoldButton.classList.contains('is-active') ? '700' : '400',
      fontStyle: refs.textItalicButton.classList.contains('is-active') ? 'italic' : 'normal',
      stroke: refs.textOutlineColorInput.value,
      strokeThickness: Number(refs.textOutlineWidthInput.value),
      align: refs.textAlignSelect.value,
      dropShadow: refs.textShadowButton.classList.contains('is-active'),
      dropShadowColor: refs.textShadowColorInput.value,
      dropShadowBlur: Number(refs.textShadowBlurInput.value),
      dropShadowDistance: Number(refs.textShadowDistanceInput.value),
      blendMode: 'normal',
    };
  }

  syncTextControlsFromSelection(object) {
    const refs = this.toolbar.refs;

    if (!object || object.__toolType !== 'text') {
      return;
    }

    const meta = object.__textData;
    refs.textSizeInput.value = String(meta.fontSize);
    refs.textColorInput.value = meta.color;
    refs.textFontSelect.value = meta.fontFamily;
    refs.textOutlineColorInput.value = meta.stroke;
    refs.textOutlineWidthInput.value = String(meta.strokeThickness);
    refs.textAlignSelect.value = meta.align ?? 'center';
    refs.textShadowColorInput.value = meta.dropShadowColor ?? '#000000';
    refs.textShadowBlurInput.value = String(meta.dropShadowBlur ?? 4);
    refs.textShadowDistanceInput.value = String(meta.dropShadowDistance ?? 6);
    refs.textBoldButton.classList.toggle('is-active', meta.fontWeight === '700');
    refs.textItalicButton.classList.toggle('is-active', meta.fontStyle === 'italic');
    refs.textShadowButton.classList.toggle('is-active', Boolean(meta.dropShadow));
  }

  syncRegionEffectControlsFromSelection(object) {
    const refs = this.toolbar.refs;

    if (!object || object.__toolType !== 'effect-region') {
      this.updateRegionEffectControlVisibility();
      return;
    }

    const data = object.__regionEffectData;

    refs.regionShapeSelect.value = data.shape.type;
    refs.regionEffectSelect.value = data.effect.type;
    refs.regionAmountInput.value = String(Math.round(data.effect.amount ?? 0));
    refs.regionRadiusInput.value = String(Math.round(data.effect.radius ?? 120));
    refs.regionMagnifyInput.value = String(Math.round((data.content.magnify ?? 1) * 100));
    refs.regionContentRotationInput.value = String(Math.round(data.content.rotation ?? 0));
    refs.regionReflectXButton.classList.toggle('is-active', data.content.reflectX === true);
    refs.regionReflectYButton.classList.toggle('is-active', data.content.reflectY === true);
    this.updateRegionEffectControlVisibility(data.effect.type);
  }

  syncRegionCreationOptionsFromToolbar() {
    const refs = this.toolbar.refs;
    const effectType = refs.regionEffectSelect.value;

    this.regionEffectTool.setCreationOptions({
      shape: {
        type: refs.regionShapeSelect.value,
      },
      content: {
        magnify: Number(refs.regionMagnifyInput.value) / 100,
        rotation: Number(refs.regionContentRotationInput.value),
        reflectX: refs.regionReflectXButton.classList.contains('is-active'),
        reflectY: refs.regionReflectYButton.classList.contains('is-active'),
      },
      effect: createDefaultRegionEffect(effectType, {
        amount: Number(refs.regionAmountInput.value),
        radius: Number(refs.regionRadiusInput.value),
        seed: this.regionCreationSeed,
      }),
      blendMode: 'normal',
    });
  }

  updateRegionEffectControlVisibility(effectType = this.toolbar.refs.regionEffectSelect.value) {
    const definition = getRegionEffectDefinition(effectType);
    const refs = this.toolbar.refs;

    refs.regionAmountField.hidden = definition.showAmount !== true;
    refs.regionRadiusField.hidden = definition.showRadius !== true;
    refs.regionReseedField.hidden = definition.showReseed !== true;
  }

  applySelectedRegionShape(shapeType) {
    const object = this.getSelectedRegionEffectObject();

    if (!object) {
      this.syncRegionCreationOptionsFromToolbar();
      this.updateRegionEffectControlVisibility();
      return;
    }

    const beforeData = JSON.parse(JSON.stringify(object.__regionEffectData));
    const nextShape = this.buildRetroactiveRegionShape(object, shapeType);

    this.regionEffectTool.updateRegionEffect(object, {
      shape: nextShape,
    });
    this.syncRegionEffectControlsFromSelection(object);
    this.commitRegionEffectHistory(object, beforeData);
  }

  buildRetroactiveRegionShape(object, shapeType) {
    const shapeBounds = this.regionEffectTool.getShapeBounds(object.__regionEffectData.shape);
    const width = Math.max(8, Math.round(shapeBounds.width));
    const height = Math.max(8, Math.round(shapeBounds.height));

    if (shapeType === 'circle') {
      return {
        type: 'circle',
        radius: Math.max(width, height) / 2,
      };
    }

    if (shapeType === 'freehand') {
      return {
        type: 'freehand',
        points: [
          { x: -width / 2, y: -height / 2 },
          { x: width / 2, y: -height / 2 },
          { x: width / 2, y: height / 2 },
          { x: -width / 2, y: height / 2 },
        ],
      };
    }

    return {
      type: 'rect',
      width,
      height,
    };
  }

  applySelectedRegionEffectType(effectType) {
    this.regionCreationSeed = Math.random();
    this.syncRegionCreationOptionsFromToolbar();

    const object = this.getSelectedRegionEffectObject();

    if (!object) {
      const effectDefaults = createDefaultRegionEffect(effectType, {
        seed: this.regionCreationSeed,
      });

      this.toolbar.refs.regionAmountInput.value = String(Math.round(effectDefaults.amount));
      this.toolbar.refs.regionRadiusInput.value = String(Math.round(effectDefaults.radius));
      this.syncRegionCreationOptionsFromToolbar();
      this.updateRegionEffectControlVisibility(effectType);
      return;
    }

    const beforeData = JSON.parse(JSON.stringify(object.__regionEffectData));
    const nextEffect = createDefaultRegionEffect(effectType, {
      seed: this.regionCreationSeed,
    });

    this.regionEffectTool.updateRegionEffect(object, {
      effect: nextEffect,
    });
    this.syncRegionEffectControlsFromSelection(object);
    this.commitRegionEffectHistory(object, beforeData);
  }

  applySelectedRegionEffectAmount(amount, recordHistory = true) {
    this.applySelectedRegionChange({
      effect: {
        amount,
      },
    }, recordHistory);
  }

  applySelectedRegionEffectRadius(radius, recordHistory = true) {
    this.applySelectedRegionChange({
      effect: {
        radius,
      },
    }, recordHistory);
  }

  applySelectedRegionMagnify(magnify, recordHistory = true) {
    this.applySelectedRegionChange({
      content: {
        magnify,
      },
    }, recordHistory);
  }

  applySelectedRegionContentRotation(rotation, recordHistory = true) {
    this.applySelectedRegionChange({
      content: {
        rotation,
      },
    }, recordHistory);
  }

  toggleSelectedRegionReflection(axis) {
    const refs = this.toolbar.refs;
    const button = axis === 'reflectY' ? refs.regionReflectYButton : refs.regionReflectXButton;
    const object = this.getSelectedRegionEffectObject();

    if (!object) {
      button.classList.toggle('is-active');
      this.syncRegionCreationOptionsFromToolbar();
      return;
    }

    const beforeData = JSON.parse(JSON.stringify(object.__regionEffectData));
    const currentValue = object.__regionEffectData.content?.[axis] === true;

    this.regionEffectTool.updateRegionEffect(object, {
      content: {
        [axis]: !currentValue,
      },
    });
    this.syncRegionEffectControlsFromSelection(object);
    this.commitRegionEffectHistory(object, beforeData);
  }

  reseedSelectedRegionEffect() {
    this.regionCreationSeed = Math.random();
    const object = this.getSelectedRegionEffectObject();

    if (!object) {
      this.syncRegionCreationOptionsFromToolbar();
      return;
    }

    const beforeData = JSON.parse(JSON.stringify(object.__regionEffectData));

    this.regionEffectTool.updateRegionEffect(object, {
      effect: {
        seed: Math.random(),
      },
    });
    this.syncRegionEffectControlsFromSelection(object);
    this.commitRegionEffectHistory(object, beforeData);
  }

  applySelectedRegionChange(partialData, recordHistory = true) {
    const object = this.getSelectedRegionEffectObject();

    if (!object) {
      this.syncRegionCreationOptionsFromToolbar();
      return;
    }

    const beforeData = JSON.parse(JSON.stringify(object.__regionEffectData));

    this.regionEffectTool.updateRegionEffect(object, partialData);
    this.syncRegionEffectControlsFromSelection(object);

    if (recordHistory) {
      this.commitRegionEffectHistory(object, beforeData);
    }
  }

  commitRegionEffectHistory(object, beforeData) {
    const afterData = JSON.parse(JSON.stringify(object.__regionEffectData));

    if (JSON.stringify(beforeData) === JSON.stringify(afterData)) {
      return;
    }

    this.historyManager.pushExecuted({
      label: 'Update region effect',
      undo: () => {
        this.regionEffectTool.updateRegionEffect(object, beforeData);
        this.syncRegionEffectControlsFromSelection(object);
      },
      redo: () => {
        this.regionEffectTool.updateRegionEffect(object, afterData);
        this.syncRegionEffectControlsFromSelection(object);
      },
    });
    this.queueAutosave();
  }

  applySelectedTextStyle(partialMeta, recordHistory = true) {
    const textObject = this.getSelectedTextObject();

    if (!textObject) {
      return;
    }

    const beforeMeta = { ...textObject.__textData };
    this.textTool.updateTextStyle(textObject, partialMeta);
    this.syncTextControlsFromSelection(textObject);

    if (recordHistory) {
      this.commitTextStyleHistory(textObject, beforeMeta);
    }
  }

  commitTextStyleHistory(textObject, beforeMeta) {
    const afterMeta = { ...textObject.__textData };

    if (JSON.stringify(beforeMeta) === JSON.stringify(afterMeta)) {
      return;
    }

    this.historyManager.pushExecuted({
      label: 'Update text style',
      undo: () => {
        this.textTool.updateTextStyle(textObject, beforeMeta);
        this.syncTextControlsFromSelection(textObject);
      },
      redo: () => {
        this.textTool.updateTextStyle(textObject, afterMeta);
        this.syncTextControlsFromSelection(textObject);
      },
    });
    this.queueAutosave();
  }

  recordLayerAdded(layer) {
    const index = this.layerManager.getLayers().findIndex((entry) => entry.id === layer.id);

    this.historyManager.pushExecuted({
      label: 'Add layer',
      undo: () => {
        this.selectTool.clearSelection();
        this.layerManager.detachLayer(layer.id);
      },
      redo: () => {
        this.layerManager.insertLayer(layer, index);
      },
    });
  }

  renderLayerPanel() {
    if (!this.layerPanel || !this.layerManager) {
      return;
    }

    const selectedPanelLayerId = this.getSelectedPanelLayerId();

    this.layerPanel.renderLayers(
      this.getLayerPanelLayers(),
      {
        selectedLayerIds: selectedPanelLayerId
          ? [selectedPanelLayerId]
          : (this.selectTool?.getSelectedLayerIds?.() ?? []),
        activeLayerId: selectedPanelLayerId ?? this.layerManager?.getActiveLayer()?.id ?? null,
      }
    );
  }

  getSelectedPanelLayerId() {
    if (this.selectedPanelLayerId === BACKGROUND_LAYER_ID && this.canvasEngine?.backgroundSprite) {
      return BACKGROUND_LAYER_ID;
    }

    return null;
  }

  getLayerPanelLayers() {
    const panelLayers = this.layerManager
      .getLayers()
      .map((layer) => this.createLayerPanelEntry(layer));
    const backgroundLayer = this.getBackgroundLayerEntry();

    if (backgroundLayer) {
      panelLayers.unshift(backgroundLayer);
    }

    return panelLayers;
  }

  getBackgroundLayerEntry() {
    if (!this.canvasEngine?.backgroundSprite) {
      return null;
    }

    return {
      id: BACKGROUND_LAYER_ID,
      type: 'background',
      name: 'Base image',
      visible: this.canvasEngine.backgroundSprite.visible !== false,
      opacity: this.canvasEngine.backgroundSprite.alpha ?? 1,
      locked: false,
      selectable: false,
      visibilityToggleable: true,
      lockToggleable: false,
      reorderable: false,
      deletable: false,
      preview: {
        kind: 'image',
        label: 'Base image',
        badge: 'IMG',
        src: this.createSpritePreviewDataUrl(this.canvasEngine.backgroundSprite),
      },
    };
  }

  createLayerPanelEntry(layer) {
    const object = this.layerManager.getPrimaryContentObject(layer);
    const isDrawingLayer = layer?.type === 'drawing';
    const settings = this.buildLayerPanelSettings(layer, object);

    return {
      ...layer,
      selectable: true,
      visibilityToggleable: true,
      lockToggleable: isDrawingLayer ? false : true,
      reorderable: true,
      deletable: isDrawingLayer ? false : true,
      preview: this.buildLayerPreview(layer, object),
      settings,
    };
  }

  buildLayerPanelSettings(layer, object) {
    if (!layer || layer.type === 'drawing' || layer.type === 'background') {
      return {
        available: false,
        expanded: false,
      };
    }

    const maskSettings = layer.type === 'mask' ? this.buildMaskLayerSettings(object) : null;
    const available = layer.type === 'mask';

    return {
      available,
      expanded: available && this.expandedLayerSettings.has(layer.id),
      mask: maskSettings,
    };
  }

  buildMaskLayerSettings(object) {
    if (!object) {
      return null;
    }

    const effects = this.getSerializedMaskEffects(object);
    const effectMap = new Map(effects.map((effect) => [effect.type, effect]));

    return {
      opacity: Math.round(Number(object.__maskMeta?.alphaValue ?? (object.alpha ?? 1) * 100)),
      zoom: Math.round(Number(object.__maskMeta?.zoomValue ?? 50)),
      angle: this.normalizeAngleDegrees((object.rotation ?? 0) * (180 / Math.PI)),
      hue: Number(Number(effectMap.get('hue')?.value ?? 0).toFixed(3)),
      invert: Boolean(effectMap.get('invert')?.enabled),
      blur: Math.round(Number(effectMap.get('blur')?.strength ?? 0)),
      noise: Math.round(Number(effectMap.get('noiseWarp')?.noise ?? 0) * 100),
      displacement: Math.round(Number(effectMap.get('displacement')?.strength ?? 0)),
    };
  }

  normalizeAngleDegrees(angle) {
    return ((Math.round(Number(angle)) % 360) + 360) % 360;
  }

  getSerializedMaskEffects(maskObject) {
    if (!maskObject) {
      return [];
    }

    if (maskObject.__effectStack?.serialize) {
      return maskObject.__effectStack.serialize();
    }

    return Array.isArray(maskObject.__maskEffectState)
      ? maskObject.__maskEffectState
      : [];
  }

  buildLayerPreview(layer, object) {
    if (!layer) {
      return {
        kind: 'placeholder',
        label: 'Layer',
        badge: 'LAY',
      };
    }

    if (layer.type === 'mask') {
      return {
        kind: 'image',
        label: layer.name,
        badge: 'MSK',
        src: this.createSpritePreviewDataUrl(object),
      };
    }

    if (layer.type === 'drawing') {
      const previewObject = object ?? layer.container.children.find((child) => child?.__toolType === 'brush-surface');
      return {
        kind: 'image',
        label: layer.name,
        badge: 'BR',
        src: this.createSpritePreviewDataUrl(previewObject),
      };
    }

    if (layer.type === 'paint-effect') {
      const previewObject = layer.paintEffectRuntime?.previewSprite ??
        layer.container.children.find((child) => child?.__toolType === 'paint-effect-preview');
      return {
        kind: 'image',
        label: layer.name,
        badge: layer.paintEffect?.badge ?? 'FX',
        src: this.createSpritePreviewDataUrl(previewObject),
      };
    }

    if (layer.type === 'image') {
      const sourceType = object?.__imageLayerData?.sourceType ?? '';
      const badge = sourceType === 'background-removal'
        ? 'CUT'
        : object?.__imageLayerData?.serviceId
          ? 'AI'
          : 'IMG';

      return {
        kind: 'image',
        label: layer.name,
        badge,
        src: this.createSpritePreviewDataUrl(object),
      };
    }

    if (layer.type === 'shape') {
      return {
        kind: 'shape',
        label: layer.name,
        badge: 'REC',
        color: object?.__shapeData?.color ?? '#7a7a7a',
        alpha: object?.__shapeData?.opacity ?? object?.alpha ?? 1,
      };
    }

    if (layer.type === 'effect-region') {
      const effectType = object?.__regionEffectData?.effect?.type ?? 'blur';

      return {
        kind: 'placeholder',
        label: layer.name,
        badge: getRegionPreviewBadge(effectType),
      };
    }

    if (layer.type === 'text') {
      const text = String(object?.text ?? '').trim();

      return {
        kind: 'text',
        label: layer.name,
        badge: 'TXT',
        text: text.slice(0, 2) || 'T',
        color: object?.__textData?.color ?? '#111111',
      };
    }

    return {
      kind: 'placeholder',
      label: layer.name,
      badge: 'LAY',
    };
  }

  createSpritePreviewDataUrl(object) {
    const source = this.resolveTextureSource(object);

    if (!source) {
      return '';
    }

    return this.createElementPreviewDataUrl(source);
  }

  resolveTextureSource(object) {
    const source = object?.texture?.source;

    return (
      source?.resource ??
      source?.source ??
      source?.element ??
      object?.texture?.baseTexture?.resource?.source ??
      null
    );
  }

  createElementPreviewDataUrl(source, size = 48) {
    if (!source || typeof document === 'undefined') {
      return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
      return '';
    }

    const width = source.videoWidth || source.naturalWidth || source.width || 0;
    const height = source.videoHeight || source.naturalHeight || source.height || 0;

    if (!width || !height) {
      return '';
    }

    const scale = Math.max(size / width, size / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const drawX = (size - drawWidth) / 2;
    const drawY = (size - drawHeight) / 2;

    try {
      context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  async removeBackgroundFromCurrentTarget() {
    if (!this.canvasEngine?.sourceImageElement) {
      this.backgroundRemovalPanel.setMessage('Load an image before removing a background.', 'warning');
      this.notify('Load an image before removing a background.', 'warning');
      return;
    }

    const panel = this.backgroundRemovalPanel;

    panel.setBusy(true, 'Preparing');
    panel.setMessage('');

    try {
      const target = await this.captureBackgroundRemovalSource();
      const layerName = this.buildBackgroundRemovalLayerName(target);
      const removedBlob = await this.backgroundRemover.removeBackground(target.imageDataUrl, {
        onProgress: (key, current, total) => {
          panel.setBusy(true, this.getBackgroundRemovalProgressLabel(key, current, total));
        },
      });
      const persistentUrl = await this.blobToDataUrl(removedBlob);
      const inserted = await this.createGeneratedImageLayer({
        result: {
          imageBlob: removedBlob,
          persistentUrl,
        },
        documentRect: target.documentRect,
        name: layerName,
        metadata: {
          sourceType: 'background-removal',
          sourceKind: target.kind,
          sourceLayerId: target.layer?.id ?? '',
          sourceLayerName: target.name,
        },
      });
      const insertedIndex = this.layerManager.getLayers().findIndex((entry) => entry.id === inserted.layer.id);

      if (target.kind === 'background') {
        this.setBackgroundVisibility(false);
        this.renderLayerPanel();
      } else {
        this.layerManager.setLayerVisibility(target.layer.id, false);
      }

      this.toolManager.setActiveTool('select');
      this.selectTool.selectLayer(inserted.layer, inserted.sprite);

      this.historyManager.pushExecuted({
        label: 'Remove background',
        undo: () => {
          this.selectTool.clearSelection();
          this.layerManager.detachLayer(inserted.layer.id);

          if (target.kind === 'background') {
            this.setBackgroundVisibility(target.originalVisible);
            this.renderLayerPanel();
            return;
          }

          this.layerManager.setLayerVisibility(target.layer.id, target.originalVisible);
        },
        redo: () => {
          this.layerManager.insertLayer(inserted.layer, insertedIndex);

          if (target.kind === 'background') {
            this.setBackgroundVisibility(false);
            this.renderLayerPanel();
          } else {
            this.layerManager.setLayerVisibility(target.layer.id, false);
          }

          this.toolManager.setActiveTool('select');
          this.selectTool.selectLayer(inserted.layer, inserted.sprite);
        },
      });

      panel.setMessage('Background removed into a new layer.', 'success');
      this.notify('Background removal completed.', 'success');
    } catch (error) {
      panel.setMessage(error.message, 'error');
      this.notify(error.message, 'error', 4200);
    } finally {
      panel.setBusy(false);
    }
  }

  async captureBackgroundRemovalSource() {
    const selectedLayer = this.selectTool.getSelectedLayer();
    const fullCanvasRect = {
      x: 0,
      y: 0,
      width: this.canvasEngine.canvasWidth,
      height: this.canvasEngine.canvasHeight,
    };

    if (!selectedLayer) {
      return {
        kind: 'background',
        name: 'Base image',
        originalVisible: this.canvasEngine.backgroundSprite?.visible !== false,
        imageDataUrl: this.cropElementToDataUrl(this.canvasEngine.sourceImageElement, fullCanvasRect),
        documentRect: fullCanvasRect,
        layer: null,
      };
    }

    const object = this.selectTool.getPrimaryLayerObject(selectedLayer);

    if (!object) {
      throw new Error('Select a layer with visible content first.');
    }

    const documentRect = this.clampDocumentRect(this.globalBoundsToDocumentRect(object.getBounds()));

    if (!documentRect.width || !documentRect.height) {
      throw new Error('The selected layer has no visible area to process.');
    }

    const fullDataUrl = await this.captureEditorComposite({
      isolateLayerId: selectedLayer.id,
    });
    const imageDataUrl =
      documentRect.width === fullCanvasRect.width &&
      documentRect.height === fullCanvasRect.height &&
      documentRect.x === 0 &&
      documentRect.y === 0
        ? fullDataUrl
        : await this.cropDataUrlToRect(fullDataUrl, documentRect);

    return {
      kind: 'layer',
      name: selectedLayer.name,
      originalVisible: selectedLayer.visible !== false,
      imageDataUrl,
      documentRect,
      layer: selectedLayer,
    };
  }

  buildBackgroundRemovalLayerName(target) {
    this.backgroundRemovalCount += 1;
    const baseName = target?.name ? `${target.name} cutout` : 'Background removed';

    return this.backgroundRemovalCount === 1
      ? baseName
      : `${baseName} ${this.backgroundRemovalCount}`;
  }

  getBackgroundRemovalProgressLabel(key, current = 0, total = 0) {
    if (typeof key !== 'string') {
      return 'Removing background';
    }

    if (key.startsWith('fetch:')) {
      const assetName = key.replace('fetch:', '');

      if (total > 0) {
        const percent = Math.round((current / total) * 100);
        return `Downloading ${assetName} (${percent}%)`;
      }

      return `Downloading ${assetName}`;
    }

    if (key === 'compute:decode') {
      return 'Decoding image';
    }

    if (key === 'compute:inference') {
      return 'Running model';
    }

    if (key === 'compute:mask') {
      return 'Building mask';
    }

    if (key === 'compute:encode') {
      return 'Encoding cutout';
    }

    return 'Removing background';
  }

  async generateAiEditedLayer() {
    if (!this.canvasEngine?.backgroundSprite) {
      this.aiEditPanel.setMessage('Load an image before using AI editing.', 'warning');
      this.notify('Load an image before using AI editing.', 'warning');
      return;
    }

    const refs = this.aiEditPanel.refs;
    const serviceId = refs.serviceSelect.value;
    const modelId = refs.modelSelect.value;
    const sourceMode = refs.sourceSelect.value;
    const prompt = refs.promptInput.value.trim();

    if (!modelId) {
      this.aiEditPanel.setMessage('Select a model first.', 'warning');
      return;
    }

    this.aiEditPanel.setBusy(true, 'Generating');
    this.aiEditPanel.setMessage('');

    try {
      const source = await this.captureAiEditSource(sourceMode);
      const result = await this.aiImageEditor.editImage({
        serviceId,
        modelId,
        prompt,
        token: refs.tokenInput.value.trim(),
        customUrl: refs.customUrlInput.value.trim(),
        imageDataUrl: source.imageDataUrl,
        mimeType: source.mimeType,
      });
      const inserted = await this.createGeneratedImageLayer({
        result,
        documentRect: source.documentRect,
        name: `AI Edit ${++this.aiEditCount}`,
        metadata: {
          serviceId,
          modelId,
          prompt,
          sourceMode,
        },
      });

      this.toolManager.setActiveTool('select');
      this.selectTool.selectLayer(inserted.layer, inserted.sprite);
      this.recordLayerAdded(inserted.layer);
      this.persistAiEditSettings();
      this.aiEditPanel.setMessage('Edited layer generated.', 'success');
      this.notify('AI edit completed.', 'success');
    } catch (error) {
      this.aiEditPanel.setMessage(error.message, 'error');
      this.notify(error.message, 'error', 4200);
    } finally {
      this.aiEditPanel.setBusy(false);
    }
  }

  async captureAiEditSource(sourceMode) {
    const fullCanvasRect = {
      x: 0,
      y: 0,
      width: this.canvasEngine.canvasWidth,
      height: this.canvasEngine.canvasHeight,
    };
    let documentRect = fullCanvasRect;
    let isolateLayerId = null;

    if (sourceMode === 'selected-layer') {
      const layer = this.selectTool.getSelectedLayer();
      const object = this.selectTool.getSelectedObject();

      if (!layer || !object || layer.type === 'drawing') {
        throw new Error('Select a non-drawing layer first.');
      }

      isolateLayerId = layer.id;
      documentRect = this.globalBoundsToDocumentRect(object.getBounds());
    }

    if (sourceMode === 'selection-bounds') {
      const selectedObjects = this.selectTool.getSelectedObjects();

      if (!selectedObjects.length) {
        throw new Error('Select something on the canvas to use selection bounds.');
      }

      documentRect = this.globalBoundsToDocumentRect(this.selectTool.getSelectionBounds());
    }

    const clampedRect = this.clampDocumentRect(documentRect);

    if (!clampedRect.width || !clampedRect.height) {
      throw new Error('The selected source area is empty.');
    }

    const fullDataUrl = await this.captureEditorComposite({
      isolateLayerId,
    });
    const imageDataUrl =
      clampedRect.width === fullCanvasRect.width &&
      clampedRect.height === fullCanvasRect.height &&
      clampedRect.x === 0 &&
      clampedRect.y === 0
        ? fullDataUrl
        : await this.cropDataUrlToRect(fullDataUrl, clampedRect);

    return {
      imageDataUrl,
      mimeType: 'image/png',
      documentRect: clampedRect,
    };
  }

  async captureEditorComposite({ isolateLayerId = null } = {}) {
    const backgroundVisible = this.canvasEngine.backgroundSprite?.visible !== false;
    const layerVisibility = this.layerManager.getLayers().map((layer) => ({
      layer,
      visible: layer.container.visible,
    }));

    if (isolateLayerId) {
      if (this.canvasEngine.backgroundSprite) {
        this.canvasEngine.backgroundSprite.visible = false;
      }

      for (const entry of layerVisibility) {
        entry.layer.container.visible = entry.layer.id === isolateLayerId;
      }
    }

    this.canvasEngine.prepareForExport('editor');

    try {
      return this.canvasEngine.toDataURL('image/png', 1);
    } finally {
      this.canvasEngine.restoreFromExport();

      if (this.canvasEngine.backgroundSprite) {
        this.canvasEngine.backgroundSprite.visible = backgroundVisible;
      }

      for (const entry of layerVisibility) {
        entry.layer.container.visible = entry.visible;
      }
    }
  }

  globalBoundsToDocumentRect(bounds) {
    const topLeft = this.canvasEngine.globalToDocumentPoint(bounds.x, bounds.y);
    const bottomRight = this.canvasEngine.globalToDocumentPoint(
      bounds.x + bounds.width,
      bounds.y + bounds.height
    );

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  }

  clampDocumentRect(rect) {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(this.canvasEngine.canvasWidth, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(this.canvasEngine.canvasHeight, Math.ceil(rect.y + rect.height));

    return {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    };
  }

  async cropDataUrlToRect(dataUrl, rect) {
    const image = await loadImageElement(dataUrl);
    const canvas = document.createElement('canvas');

    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not crop the AI source image.');
    }

    context.drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height
    );

    return canvas.toDataURL('image/png');
  }

  async blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Could not read the generated image.'));
      };
      reader.onerror = () => reject(new Error('Could not read the generated image.'));
      reader.readAsDataURL(blob);
    });
  }

  async createGeneratedImageLayer({ result, documentRect, name, metadata = {}, objectState = null }) {
    const blob = await this.resolveAiResultBlob(result);
    const objectUrl = URL.createObjectURL(blob);
    const image = await loadImageElement(objectUrl);
    const texture = PIXI.Texture.from(image);
    const sprite = new PIXI.Sprite(texture);

    sprite.anchor.set(0);
    sprite.position.set(documentRect.x, documentRect.y);
    sprite.scale.set(
      documentRect.width / Math.max(1, texture.width),
      documentRect.height / Math.max(1, texture.height)
    );
    sprite.alpha = 1;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.__toolType = 'image';
    sprite.__imageLayerData = {
      ...metadata,
      objectUrl,
      persistentUrl: result.persistentUrl || '',
      mimeType: blob.type || 'image/png',
    };

    if (objectState) {
      applyObjectState(sprite, objectState);
    }

    const layerId = this.layerManager.addLayer(name, 'image');
    const layer = this.layerManager.getLayer(layerId);

    layer.container.addChild(sprite);

    return {
      layer,
      sprite,
    };
  }

  async resolveAiResultBlob(result) {
    if (result?.imageBlob instanceof Blob) {
      return result.imageBlob;
    }

    if (result?.imageDataUrl) {
      const response = await fetch(result.imageDataUrl);
      return response.blob();
    }

    if (result?.imageUrl) {
      const response = await fetch(result.imageUrl);

      if (!response.ok) {
        throw new Error('The generated image could not be downloaded.');
      }

      return response.blob();
    }

    throw new Error('The AI service returned no usable image.');
  }

  async restoreGeneratedImageLayer(layerState) {
    const imageLayerData = layerState?.object?.imageLayerData ?? {};
    const persistentUrl = imageLayerData.persistentUrl;

    if (!persistentUrl) {
      return null;
    }

    const response = await fetch(persistentUrl);

    if (!response.ok) {
      throw new Error('The saved generated image could not be restored.');
    }

    const blob = await response.blob();
    const inserted = await this.createGeneratedImageLayer({
      result: {
        imageBlob: blob,
        persistentUrl,
      },
      documentRect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
      name: layerState.name,
      metadata: imageLayerData,
      objectState: layerState.object,
    });
    inserted.layer.visible = layerState.visible !== false;
    inserted.layer.locked = layerState.locked === true;
    inserted.layer.container.visible = inserted.layer.visible;
    this.layerManager.setLayerOpacity(inserted.layer.id, layerState.opacity ?? 1);

    return inserted.layer;
  }

  duplicateSelectedObject() {
    this.toolManager.setActiveTool('select');

    if (this.selectTool.getSelectedLayers().length === 0) {
      this.selectTool.selectLastSelectableLayer();
    }

    const duplicatedEntries = this.selectTool.duplicateSelection();

    if (!duplicatedEntries.length) {
      return;
    }

    const inserted = duplicatedEntries.map(({ layer }) => ({
      layer,
      index: this.layerManager.getLayers().findIndex((entry) => entry.id === layer.id),
    }));

    this.historyManager.pushExecuted({
      label: duplicatedEntries.length > 1 ? 'Duplicate selection' : 'Duplicate object',
      undo: () => {
        this.selectTool.clearSelection();

        [...inserted]
          .reverse()
          .forEach(({ layer }) => {
            this.layerManager.detachLayer(layer.id);
          });
      },
      redo: () => {
        inserted.forEach(({ layer, index }) => {
          this.layerManager.insertLayer(layer, index);
        });
        this.selectTool.setSelectionEntries(
          inserted.map(({ layer }) => ({
            layer,
            object: this.selectTool.getPrimaryLayerObject(layer),
          }))
        );
      },
    });
  }

  deleteSelectedObject() {
    this.toolManager.setActiveTool('select');
    const selectedLayers = this.selectTool.getSelectedLayers();

    if (!selectedLayers.length) {
      return;
    }

    const removedLayers = selectedLayers
      .filter((layer) => layer.type !== 'drawing')
      .map((layer) => this.layerManager.detachLayer(layer.id))
      .filter(Boolean);

    if (!removedLayers.length) {
      return;
    }

    this.selectTool.clearSelection();
    this.historyManager.pushExecuted({
      label: removedLayers.length > 1 ? 'Delete selection' : 'Delete layer',
      undo: () => {
        removedLayers.forEach(({ layer, index }) => {
          this.layerManager.insertLayer(layer, index);
        });
        this.selectTool.setSelectionEntries(
          removedLayers.map(({ layer }) => ({
            layer,
            object: this.selectTool.getPrimaryLayerObject(layer),
          }))
        );
      },
      redo: () => {
        this.selectTool.clearSelection();

        [...removedLayers]
          .reverse()
          .forEach(({ layer }) => {
            this.layerManager.detachLayer(layer.id);
          });
      },
    });
  }

  deleteLayer(layerId) {
    const layer = this.layerManager.getLayer(layerId);

    if (!layer || layer.type === 'drawing') {
      return;
    }

    const removed = this.layerManager.detachLayer(layer.id);

    if (!removed) {
      return;
    }

    this.selectTool.clearSelection();
    this.historyManager.pushExecuted({
      label: 'Delete layer',
      undo: () => {
        this.layerManager.insertLayer(removed.layer, removed.index);
      },
      redo: () => {
        this.selectTool.clearSelection();
        this.layerManager.detachLayer(removed.layer.id);
      },
    });
  }

  selectLayerById(layerId, options = {}) {
    if (layerId === BACKGROUND_LAYER_ID) {
      if (!this.canvasEngine?.backgroundSprite) {
        return;
      }

      this.selectTool.clearSelection();
      this.selectedPanelLayerId = BACKGROUND_LAYER_ID;
      this.renderLayerPanel();
      return;
    }

    this.selectedPanelLayerId = null;
    const layer = this.layerManager.getLayer(layerId);
    const activeToolName = this.toolManager.getActiveToolName();
    const { append = false } = options;

    if (!layer || layer.locked || layer.visible === false) {
      return;
    }

    this.layerManager.setActiveLayer(layer.id);
    const object = this.selectTool.getPrimaryLayerObject(layer);

    if (object) {
      this.selectTool.selectLayer(layer, object, {
        append,
      });
    } else if (!append) {
      this.selectTool.clearSelection();
    }

    if (!['brush', 'eraser', 'blur-brush', 'pixelate-brush'].includes(activeToolName)) {
      this.toolManager.setActiveTool('select');
    }

    this.renderLayerPanel();
  }

  toggleLayerVisibility(layerId) {
    if (layerId === BACKGROUND_LAYER_ID) {
      if (!this.canvasEngine?.backgroundSprite) {
        return;
      }

      const nextVisible = this.canvasEngine.backgroundSprite.visible === false;
      this.setBackgroundVisibility(nextVisible);
      this.renderLayerPanel();
      this.queueAutosave();
      return;
    }

    const layer = this.layerManager.getLayer(layerId);

    if (!layer) {
      return;
    }

    const nextVisible = !layer.visible;
    this.layerManager.setLayerVisibility(layerId, nextVisible);

    if (!nextVisible && this.selectTool.getSelectedLayers().some((selectedLayer) => selectedLayer.id === layerId)) {
      this.selectTool.clearSelection();
    }
  }

  toggleLayerLock(layerId) {
    const layer = this.layerManager.getLayer(layerId);

    if (!layer) {
      return;
    }

    const nextLocked = !layer.locked;
    this.layerManager.setLayerLocked(layerId, nextLocked);

    if (nextLocked && this.selectTool.getSelectedLayers().some((selectedLayer) => selectedLayer.id === layerId)) {
      this.selectTool.clearSelection();
    }
  }

  moveLayer(layerId, direction) {
    const layers = this.layerManager.getLayers();
    const currentIndex = layers.findIndex((layer) => layer.id === layerId);

    if (currentIndex === -1) {
      return;
    }

    this.layerManager.reorderLayer(layerId, currentIndex + direction);
  }

  renameLayer(layerId, value) {
    const layer = this.layerManager.getLayer(layerId);

    if (!layer) {
      return;
    }

    const nextName = value.trim() || layer.name;
    this.layerManager.setLayerName(layerId, nextName);
  }

  toggleLayerSettings(layerId) {
    if (this.expandedLayerSettings.has(layerId)) {
      this.expandedLayerSettings.delete(layerId);
    } else {
      this.expandedLayerSettings.add(layerId);
    }

    this.renderLayerPanel();
  }

  getLayerObjectEntry(layerId) {
    const layer = this.layerManager.getLayer(layerId);
    const object = this.layerManager.getPrimaryContentObject(layer);

    return {
      layer,
      object,
    };
  }

  formatLayerSettingValue(setting, value) {
    const numericValue = Number(value);

    if (setting === 'opacity' || setting === 'noise') {
      return `${Math.round(numericValue)}%`;
    }

    if (setting === 'angle') {
      return `${this.normalizeAngleDegrees(numericValue)}deg`;
    }

    if (setting === 'hue') {
      return numericValue.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    }

    return `${Math.round(numericValue)}`;
  }

  applyMaskLayerSetting(layerId, setting, value) {
    const { layer, object } = this.getLayerObjectEntry(layerId);

    if (!layer || layer.type !== 'mask' || object?.__toolType !== 'mask') {
      return;
    }

    if (setting === 'opacity') {
      this.maskEffects.updateOpacity(value, object);
    }

    if (setting === 'zoom') {
      this.maskEffects.updateZoom(value, object);
    }

    if (setting === 'angle') {
      this.maskEffects.rotateMask(value, object);
    }

    if (setting === 'hue') {
      this.maskEffects.updateHue(value, object);
    }

    if (setting === 'blur') {
      this.maskEffects.updateBlur(value, object);
    }

    if (setting === 'noise') {
      this.maskEffects.updateNoiseWarp(value, object);
    }

    if (setting === 'displacement') {
      this.maskEffects.updateDisplacement(value, object);
    }

    this.syncSelectedMaskControls(layer, object);
  }

  snapshotMaskLayerState(layerId) {
    const { layer, object } = this.getLayerObjectEntry(layerId);

    if (!layer || layer.type !== 'mask' || object?.__toolType !== 'mask') {
      return null;
    }

    return this.maskEffects.snapshotCurrentMask(object);
  }

  getMaskSettingHistoryLabel(setting) {
    if (setting === 'opacity') {
      return 'Update mask opacity';
    }

    if (setting === 'zoom') {
      return 'Update mask zoom';
    }

    if (setting === 'angle') {
      return 'Rotate mask';
    }

    if (setting === 'hue') {
      return 'Update mask hue';
    }

    if (setting === 'blur') {
      return 'Update mask blur';
    }

    if (setting === 'noise') {
      return 'Update mask noise';
    }

    if (setting === 'displacement') {
      return 'Update mask warp';
    }

    return 'Update mask';
  }

  commitMaskLayerHistory(layerId, beforeState, afterState, label = 'Update mask') {
    if (!beforeState || !afterState || JSON.stringify(beforeState) === JSON.stringify(afterState)) {
      return;
    }

    const applySnapshot = (snapshot) => {
      const { layer, object } = this.getLayerObjectEntry(layerId);

      if (!layer || object?.__toolType !== 'mask') {
        return;
      }

      this.maskEffects.restoreCurrentMask(snapshot, object);
      this.syncSelectedMaskControls(layer, object, snapshot);
      this.renderLayerPanel();
    };

    this.historyManager.pushExecuted({
      label,
      undo: () => applySnapshot(beforeState),
      redo: () => applySnapshot(afterState),
    });
    this.queueAutosave();
  }

  toggleMaskLayerInvert(layerId) {
    const { layer, object } = this.getLayerObjectEntry(layerId);
    const beforeState = this.snapshotMaskLayerState(layerId);

    if (!layer || object?.__toolType !== 'mask' || !beforeState) {
      return;
    }

    this.maskEffects.invert(object);
    const afterState = this.maskEffects.snapshotCurrentMask(object);

    this.syncSelectedMaskControls(layer, object, afterState);
    this.renderLayerPanel();
    this.commitMaskLayerHistory(layerId, beforeState, afterState, 'Toggle mask invert');
  }

  reseedMaskLayerDisplacement(layerId) {
    const { layer, object } = this.getLayerObjectEntry(layerId);
    const beforeState = this.snapshotMaskLayerState(layerId);

    if (!layer || object?.__toolType !== 'mask' || !beforeState) {
      return;
    }

    this.maskEffects.reseedDisplacement(object);
    const afterState = this.maskEffects.snapshotCurrentMask(object);

    this.syncSelectedMaskControls(layer, object, afterState);
    this.renderLayerPanel();
    this.commitMaskLayerHistory(layerId, beforeState, afterState, 'Reseed mask warp');
  }

  syncSelectedMaskControls(layer, object, snapshot = null) {
    if (this.selectTool.getSelectedLayer()?.id !== layer?.id) {
      return;
    }

    this.maskManager.setCurrentMask(object, layer);
    this.syncMaskControlsFromState(snapshot ?? this.maskEffects.snapshotCurrentMask(object));
  }

  applyLayerOpacity(layerId, opacity) {
    const nextOpacity = Math.max(0, Math.min(1, Number(opacity)));

    if (layerId === BACKGROUND_LAYER_ID) {
      if (!this.canvasEngine?.backgroundSprite) {
        return;
      }

      this.canvasEngine.backgroundSprite.alpha = nextOpacity;

      if (this.currentBackgroundSource) {
        this.currentBackgroundSource.opacity = nextOpacity;
      }

      return;
    }

    this.layerManager.setLayerOpacity(layerId, nextOpacity);
  }

  commitLayerOpacityHistory(layerId, beforeOpacity, afterOpacity) {
    if (!Number.isFinite(beforeOpacity) || !Number.isFinite(afterOpacity)) {
      return;
    }

    const clampedBefore = Math.max(0, Math.min(1, beforeOpacity));
    const clampedAfter = Math.max(0, Math.min(1, afterOpacity));

    if (Math.abs(clampedBefore - clampedAfter) < 0.001) {
      return;
    }

    const label = layerId === BACKGROUND_LAYER_ID ? 'Update base image opacity' : 'Update layer opacity';

    this.historyManager.pushExecuted({
      label,
      undo: () => {
        this.applyLayerOpacity(layerId, clampedBefore);
        this.renderLayerPanel();
      },
      redo: () => {
        this.applyLayerOpacity(layerId, clampedAfter);
        this.renderLayerPanel();
      },
    });
    this.queueAutosave();
  }

  adjustSelectedObjectOpacity(delta) {
    const selectedObjects = this.selectTool.getSelectedObjects();
    const targetObjects = selectedObjects.length > 0
      ? selectedObjects
      : [this.selectTool.getPrimaryLayerObject(this.layerManager.getLastNonDrawingLayer())].filter(Boolean);

    if (!targetObjects.length) {
      return;
    }

    const beforeEntries = targetObjects.map((object) => ({
      object,
      beforeState: snapshotObjectState(object),
    }));

    for (const entry of beforeEntries) {
      entry.object.alpha = Math.max(0.1, Math.min(1, entry.object.alpha + delta));
    }

    const changedEntries = beforeEntries
      .map((entry) => ({
        object: entry.object,
        beforeState: entry.beforeState,
        afterState: snapshotObjectState(entry.object),
      }))
      .filter((entry) => !objectStatesEqual(entry.beforeState, entry.afterState));

    if (!changedEntries.length) {
      return;
    }

    for (const entry of changedEntries) {
      this.eventBus.emit('object:changed', { object: entry.object });
    }

    this.historyManager.pushExecuted({
      label: changedEntries.length > 1 ? 'Adjust selection opacity' : 'Adjust object opacity',
      undo: () => {
        for (const entry of changedEntries) {
          applyObjectState(entry.object, entry.beforeState);
          this.eventBus.emit('object:changed', { object: entry.object });
        }
      },
      redo: () => {
        for (const entry of changedEntries) {
          applyObjectState(entry.object, entry.afterState);
          this.eventBus.emit('object:changed', { object: entry.object });
        }
      },
    });
  }

  adjustMaskRotationByDelta(deltaDegrees) {
    const beforeState = this.maskEffects.snapshotCurrentMask();

    if (!beforeState) {
      return;
    }

    const nextAngleDegrees = beforeState.rotation * (180 / Math.PI) + deltaDegrees;
    this.maskEffects.rotateMask(nextAngleDegrees);
    const afterState = this.maskEffects.snapshotCurrentMask();

    if (!afterState || JSON.stringify(beforeState) === JSON.stringify(afterState)) {
      return;
    }

    this.syncMaskControlsFromState(afterState);
    this.historyManager.pushExecuted({
      label: 'Rotate mask',
      undo: () => {
        this.maskEffects.restoreCurrentMask(beforeState);
        this.syncMaskControlsFromState(beforeState);
      },
      redo: () => {
        this.maskEffects.restoreCurrentMask(afterState);
        this.syncMaskControlsFromState(afterState);
      },
    });
  }

  nudgeSelectedObject(deltaX, deltaY) {
    const objects = this.selectTool.getSelectedObjects();

    if (!objects.length) {
      return;
    }

    const changedEntries = objects
      .map((object) => {
        const beforeState = snapshotObjectState(object);
        object.position.set(object.x + deltaX, object.y + deltaY);
        this.eventBus.emit('object:changed', { object });
        const afterState = snapshotObjectState(object);

        return {
          object,
          beforeState,
          afterState,
        };
      })
      .filter((entry) => !objectStatesEqual(entry.beforeState, entry.afterState));

    if (!changedEntries.length) {
      return;
    }

    this.historyManager.pushExecuted({
      label: changedEntries.length > 1 ? 'Nudge selection' : 'Nudge object',
      undo: () => {
        for (const entry of changedEntries) {
          applyObjectState(entry.object, entry.beforeState);
          this.eventBus.emit('object:changed', { object: entry.object });
        }
      },
      redo: () => {
        for (const entry of changedEntries) {
          applyObjectState(entry.object, entry.afterState);
          this.eventBus.emit('object:changed', { object: entry.object });
        }
      },
    });
  }

  async uploadToImgur() {
    const refs = this.canvasArea.refs;
    const exportOptions = this.getCurrentExportOptions();

    refs.uploadButton.textContent = 'Uploading...';
    refs.uploadButton.disabled = true;
    refs.canvasHost.classList.add('hidden');
    refs.previewImage.style.display = 'block';

    try {
      const dataUrl = await this.exportManager.exportDataUrl(exportOptions);
      refs.previewImage.querySelector('#imagePreview').src = dataUrl;
      const result = await this.imgurUploader.upload(dataUrl);
      refs.uploadedUrl.value = result.url;
      refs.uploadButton.textContent = 'Reupload';
      refs.uploadedUrl.classList.remove('hidden');
      refs.copyUrlButton.classList.remove('hidden');
      refs.checkRisButton.classList.remove('hidden');
      refs.postRedditButton.classList.remove('hidden');
      refs.roundTitle.classList.remove('hidden');
      refs.roundAnswer.classList.remove('hidden');
      refs.saveButton.classList.remove('hidden');
      refs.exportButton.classList.remove('hidden');
      this.notify('Upload completed.', 'success');
    } catch (error) {
      this.notify(`Error uploading to Imgur. Reason: ${error.message}`, 'error', 3600);
      refs.uploadButton.textContent = 'Upload to Imgur';
    } finally {
      refs.uploadButton.disabled = false;
      refs.canvasHost.classList.remove('hidden');
      refs.previewImage.style.display = 'none';
    }
  }

  async copyImage() {
    const clipboardSupportIssues = [];

    if (!window.isSecureContext) {
      clipboardSupportIssues.push('this page is not in a secure context; use https:// or http://localhost instead of file://');
    }

    if (!window.ClipboardItem) {
      clipboardSupportIssues.push('ClipboardItem is unavailable');
    }

    if (!navigator.clipboard?.write) {
      clipboardSupportIssues.push('navigator.clipboard.write is unavailable');
    }

    if (clipboardSupportIssues.length) {
      this.notify(
        `Clipboard image copy isn't available because ${clipboardSupportIssues.join('; ')}.`,
        'warning',
        6200
      );
      return;
    }

    // PNG is the only image type the Clipboard API reliably guarantees across browsers.
    const exportOptions = {
      ...this.getCurrentExportOptions(),
      format: 'png',
    };
    const mimeType = 'image/png';

    try {
      const blob = await this.exportManager.exportBlob(exportOptions);
      const item = new ClipboardItem({ [mimeType]: blob });
      await navigator.clipboard.write([item]);
      this.notify('Image copied to clipboard.', 'success');
    } catch (error) {
      const reason = error?.name ? `${error.name}: ${error.message || 'Clipboard write failed.'}` : 'Clipboard write failed.';
      this.notify(
        `Clipboard image copy failed. ${reason}`,
        'warning',
        6200
      );
    }
  }

  async downloadImage() {
    const exportOptions = this.getCurrentExportOptions();

    try {
      const blob = await this.exportManager.exportBlob(exportOptions);
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = this.exportManager.buildFilename(exportOptions.format);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
      this.notify('Download started.', 'success');
    } catch (error) {
      this.notify('Download failed.', 'error');
    }
  }

  saveRoundFromEditor() {
    this.savedRoundsController.saveRoundFromEditor();
  }

  saveRoundFromUrl() {
    this.savedRoundsController.saveRoundFromUrl();
  }

  toggleSavedRounds() {
    this.savedRoundsController.toggleSavedRounds();
  }

  toggleSaveFromUrl() {
    this.savedRoundsController.toggleSaveFromUrl();
  }

  displaySavedRounds(direction) {
    this.savedRoundsController.displaySavedRounds(direction);
  }

  renderSavedRound() {
    this.savedRoundsController.renderSavedRound();
  }

  deleteSavedRound() {
    this.savedRoundsController.deleteSavedRound();
  }

  async copyYml({ roundTitle, roundAnswer, imageUrl }) {
    const text = `masker_round_${Date.now()}:\n  title: |\n    ${roundTitle}\n  url: ${imageUrl}\n  answer: ${roundAnswer}\n`;
    await this.copyText(text, 'YML copied to clipboard.');
  }

  async copyText(text, successMessage = 'Copied to clipboard.') {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      this.notify(successMessage, 'success');
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.notify(successMessage, 'success');
  }

  isEditableTarget(target) {
    const tagName = target?.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  }

  isValidImageUrl(url) {
    return /\.(jpeg|jpg|png|gif)(?:[?#].*)?$/i.test(url.trim());
  }

  async loadExternalImage(url) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return false;
    }

    if (!this.isValidImageUrl(trimmedUrl)) {
      this.notify('Only .jpeg, .jpg, .png, and .gif image URLs are supported.', 'warning');
      return false;
    }

    try {
      await this.canvasEngine.loadBackgroundImage(trimmedUrl, true);
      this.setBackgroundSource({
        type: 'external',
        url: trimmedUrl,
      });
      this.applyImageLoadedUiState();
      this.canvasArea.refs.mobilePasteInput.value = '';
      return true;
    } catch (error) {
      this.notify('Something went wrong while loading the image URL.', 'error');
      throw error;
    }
  }

  async handlePaste(event) {
    const targetId = event.target?.id ?? '';
    const clipboardData = event.clipboardData;
    const items = [...(clipboardData?.items ?? [])];

    if (!items.length) {
      return;
    }

    if (targetId === this.canvasArea.refs.mobileRisInput.id) {
      const textItem = items.find((item) => item.kind === 'string' && item.type === 'text/plain');

      if (textItem) {
        textItem.getAsString((value) => {
          this.canvasArea.refs.mobileRisInput.value = value;
          this.risChecker.check(value.trim());
        });
      }

      return;
    }

    if (
      this.isEditableTarget(event.target) &&
      targetId !== this.canvasArea.refs.mobilePasteInput.id
    ) {
      return;
    }

    const fileItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (fileItem) {
      const file = fileItem.getAsFile();

      if (file) {
        event.preventDefault();
        if (this.shouldPasteImageAsLayer()) {
          await this.addLocalImageLayer(file);
        } else {
          await this.loadLocalFile(file);
        }
      }

      return;
    }

    const textItem = items.find((item) => item.kind === 'string' && item.type === 'text/plain');
    if (!textItem) {
      return;
    }

    textItem.getAsString((value) => {
      const trimmedValue = value.trim();

      if (targetId === this.canvasArea.refs.mobilePasteInput.id) {
        this.canvasArea.refs.mobilePasteInput.value = trimmedValue;
      }

      if (this.isValidImageUrl(trimmedValue)) {
        if (this.shouldPasteImageAsLayer()) {
          void this.addExternalImageLayer(trimmedValue);
        } else {
          void this.loadExternalImage(trimmedValue);
        }
      }
    });
  }

  shouldPasteImageAsLayer() {
    return Boolean(
      this.canvasArea?.refs?.pasteAsLayerInput?.checked &&
      this.canvasEngine?.backgroundSprite
    );
  }

  getImportedImageLayerName(name = '') {
    const trimmedName = String(name ?? '').trim();
    const sanitizedName = trimmedName.replace(/\.[^.]+$/, '');

    if (!sanitizedName || /^image$/i.test(sanitizedName)) {
      return 'Pasted image';
    }

    return sanitizedName;
  }

  getImportedImageLayerRect(imageWidth, imageHeight) {
    const documentWidth = Math.max(1, this.canvasEngine?.canvasWidth ?? imageWidth ?? 1);
    const documentHeight = Math.max(1, this.canvasEngine?.canvasHeight ?? imageHeight ?? 1);
    const safeImageWidth = Math.max(1, imageWidth ?? 1);
    const safeImageHeight = Math.max(1, imageHeight ?? 1);
    const scale = Math.min(
      documentWidth / safeImageWidth,
      documentHeight / safeImageHeight,
      1
    );
    const width = Math.max(1, Math.round(safeImageWidth * scale));
    const height = Math.max(1, Math.round(safeImageHeight * scale));

    return {
      x: Math.round((documentWidth - width) / 2),
      y: Math.round((documentHeight - height) / 2),
      width,
      height,
    };
  }

  async createImageLayerFromSource({
    source,
    isExternal = false,
    name = 'Pasted image',
    metadata = {},
    objectState = null,
  } = {}) {
    const resolvedSource = isExternal ? addProxyToUrl(source) : source;
    const image = await loadImageElement(resolvedSource, {
      crossOrigin: isExternal ? 'anonymous' : null,
    });
    const texture = PIXI.Texture.from(image);
    const sprite = new PIXI.Sprite(texture);
    const imageWidth = image.naturalWidth || image.width || texture.width;
    const imageHeight = image.naturalHeight || image.height || texture.height;
    const documentRect = this.getImportedImageLayerRect(imageWidth, imageHeight);

    sprite.anchor.set(0);
    sprite.position.set(documentRect.x, documentRect.y);
    sprite.scale.set(
      documentRect.width / Math.max(1, texture.width),
      documentRect.height / Math.max(1, texture.height)
    );
    sprite.alpha = 1;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.__toolType = 'image';
    sprite.__imageLayerData = {
      ...metadata,
      persistentUrl: metadata.persistentUrl || '',
    };

    if (objectState) {
      applyObjectState(sprite, objectState);
    }

    const layerId = this.layerManager.addLayer(name, 'image');
    const layer = this.layerManager.getLayer(layerId);

    layer.container.addChild(sprite);

    return {
      layer,
      sprite,
    };
  }

  finalizeInsertedImageLayer(inserted) {
    this.toolManager.setActiveTool('select');
    this.selectTool.selectLayer(inserted.layer, inserted.sprite);
    this.recordLayerAdded(inserted.layer);
  }

  async addLocalImageLayer(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
      const inserted = await this.createImageLayerFromSource({
        source: objectUrl,
        name: this.getImportedImageLayerName(file?.name),
        metadata: {
          sourceType: 'clipboard',
          fileName: file?.name ?? '',
          mimeType: file?.type || 'image/png',
        },
      });
      this.finalizeInsertedImageLayer(inserted);
      return inserted;
    } catch (error) {
      this.notify('Something went wrong while adding the pasted image as a layer.', 'error');
      throw error;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async addExternalImageLayer(url) {
    try {
      const inserted = await this.createImageLayerFromSource({
        source: url,
        isExternal: true,
        metadata: {
          sourceType: 'clipboard-url',
          sourceUrl: url,
        },
      });
      this.finalizeInsertedImageLayer(inserted);
      this.canvasArea.refs.mobilePasteInput.value = '';
      return inserted;
    } catch (error) {
      this.notify('Something went wrong while adding the image URL as a layer.', 'error');
      throw error;
    }
  }

  async loadLocalFile(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
      await this.canvasEngine.loadBackgroundImage(objectUrl, false);
      this.setBackgroundSource({
        type: 'local',
        name: file.name,
        mimeType: file.type,
      });
      this.applyImageLoadedUiState();
    } catch (error) {
      this.notify('Something went wrong while loading the image.', 'error');
      throw error;
    } finally {
      URL.revokeObjectURL(objectUrl);
      this.canvasArea.refs.fileInput.value = '';
    }
  }
}
