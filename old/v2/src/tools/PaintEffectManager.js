import { createDefaultRegionEffect, getRegionPreviewBadge } from './regionDefinitions.js';

const { BlurFilter, RenderTexture, Sprite } = PIXI;
const COMMUNITY_FILTERS = PIXI.filters ?? {};

export class PaintEffectManager {
  constructor(canvasEngine, layerManager, eventBus, brushTool) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.brushTool = brushTool;
    this.count = 0;

    this.eventBus.on('image:loaded', () => {
      this.refreshAll();
    });

    this.eventBus.on('layer:added', () => {
      this.refreshAll();
    });

    this.eventBus.on('layer:removed', () => {
      this.refreshAll();
    });

    this.eventBus.on('layer:reordered', () => {
      this.refreshAll();
    });

    this.eventBus.on('layer:updated', () => {
      this.refreshAll();
    });

    this.eventBus.on('layer:paint-changed', ({ layerId }) => {
      this.refreshFromLayer(layerId);
    });

    this.eventBus.on('object:changed', ({ object }) => {
      this.handleObjectStackChange(object);
    });

    this.eventBus.on('object:transformed', ({ object }) => {
      this.handleObjectStackChange(object);
    });

    this.eventBus.on('objects:transformed', ({ entries }) => {
      for (const entry of entries ?? []) {
        this.handleObjectStackChange(entry?.object);
      }
    });

    this.eventBus.on('export:start', () => {
      this.refreshAll();
    });

    this.eventBus.on('export:complete', () => {
      this.refreshAll();
    });
  }

  createLayer(effectType = 'blur', options = {}) {
    const defaultEffect = createDefaultRegionEffect(effectType, {
      amount: options.amount,
    });
    const layerId = this.layerManager.addLayer(
      options.name ?? `${effectType === 'pixelate' ? 'Pixelate' : 'Blur'} paint ${++this.count}`,
      'paint-effect'
    );
    const layer = this.layerManager.getLayer(layerId);

    layer.paintEffect = {
      type: effectType,
      amount: Number(options.amount ?? defaultEffect.amount),
      opacity: Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : 1,
      badge: getRegionPreviewBadge(effectType),
    };
    this.layerManager.setActiveLayer(layerId);
    this.brushTool.ensureSurface(layerId);
    this.refreshLayer(layerId);

    return layer;
  }

  ensureActiveEffectLayer(effectType, options = {}) {
    const activeLayer = this.layerManager.getActiveLayer();

    if (this.isPaintEffectLayer(activeLayer, effectType)) {
      if (Number.isFinite(Number(options.opacity))) {
        activeLayer.paintEffect.opacity = Number(options.opacity);
      }

      if (Number.isFinite(Number(options.amount))) {
        activeLayer.paintEffect.amount = Number(options.amount);
        this.refreshLayer(activeLayer.id);
      }

      return activeLayer;
    }

    return this.createLayer(effectType, options);
  }

  isPaintEffectLayer(layer, effectType = null) {
    return Boolean(
      layer &&
      layer.type === 'paint-effect' &&
      layer.paintEffect &&
      (effectType ? layer.paintEffect.type === effectType : true)
    );
  }

  updateLayerEffect(layerId, partial = {}) {
    const layer = this.layerManager.getLayer(layerId);

    if (!this.isPaintEffectLayer(layer)) {
      return;
    }

    layer.paintEffect = {
      ...layer.paintEffect,
      ...partial,
    };
    this.refreshLayer(layerId);
  }

  getLayerEffect(layerId) {
    return this.layerManager.getLayer(layerId)?.paintEffect ?? null;
  }

  refreshAll() {
    for (const layer of this.layerManager.getLayers()) {
      if (this.isPaintEffectLayer(layer)) {
        this.refreshLayer(layer.id);
      }
    }
  }

  refreshFromLayer(layerId) {
    if (!layerId) {
      return;
    }

    const layers = this.layerManager.getLayers();
    const layerIndex = layers.findIndex((layer) => layer.id === layerId);

    if (layerIndex === -1) {
      return;
    }

    for (let index = layerIndex; index < layers.length; index += 1) {
      if (this.isPaintEffectLayer(layers[index])) {
        this.refreshLayer(layers[index].id);
      }
    }
  }

  handleObjectStackChange(object) {
    if (!object) {
      return;
    }

    const layer = this.findLayerForObject(object);

    if (layer) {
      this.refreshFromLayer(layer.id);
    }
  }

  refreshLayer(layerId) {
    const layer = this.layerManager.getLayer(layerId);

    if (!this.isPaintEffectLayer(layer)) {
      return;
    }

    const sourceTexture = this.renderSourceTextureForLayer(layerId);
    const layerState = this.brushTool.getLayerState(layerId);
    this.brushTool.ensureSurface(layerId);
    const maskSprite = layerState.sprite;

    if (!maskSprite) {
      return;
    }

    maskSprite.__toolType = 'brush-surface';
    const previousPreview = layer.paintEffectRuntime?.previewSprite ?? null;
    const previousTexture = layer.paintEffectRuntime?.previewTexture ?? null;

    if (previousPreview?.parent === layer.container) {
      layer.container.removeChild(previousPreview);
    }

    if (!sourceTexture) {
      previousPreview?.destroy();
      previousTexture?.destroy(true);
      layer.paintEffectRuntime = {
        previewSprite: null,
        previewTexture: null,
      };
      return;
    }

    const previewSprite = new Sprite(sourceTexture);
    previewSprite.width = this.canvasEngine.canvasWidth;
    previewSprite.height = this.canvasEngine.canvasHeight;
    previewSprite.eventMode = 'none';
    previewSprite.cursor = 'default';
    previewSprite.__toolType = 'paint-effect-preview';
    previewSprite.mask = maskSprite;
    previewSprite.filters = this.buildFilters(layer.paintEffect);

    layer.container.addChildAt(previewSprite, 0);

    if (previousPreview) {
      previousPreview.destroy();
    }

    if (previousTexture) {
      previousTexture.destroy(true);
    }

    layer.paintEffectRuntime = {
      previewSprite,
      previewTexture: sourceTexture,
    };
  }

  buildFilters(paintEffect) {
    if (!paintEffect) {
      return null;
    }

    if (paintEffect.type === 'pixelate') {
      const FilterClass = COMMUNITY_FILTERS.PixelateFilter;

      if (!FilterClass) {
        return null;
      }

      return [new FilterClass(Math.max(1, Math.round(paintEffect.amount ?? 12)))];
    }

    const filter = new BlurFilter();
    filter.strength = Math.max(0, Number(paintEffect.amount ?? 12) / 2);
    return [filter];
  }

  renderSourceTextureForLayer(layerId) {
    const renderer = this.canvasEngine.app?.renderer;
    const documentContainer = this.canvasEngine.documentContainer;
    const layers = this.layerManager.getLayers();
    const layerIndex = layers.findIndex((layer) => layer.id === layerId);

    if (!renderer || !documentContainer || layerIndex === -1) {
      return null;
    }

    const texture = RenderTexture.create({
      width: this.canvasEngine.canvasWidth,
      height: this.canvasEngine.canvasHeight,
      resolution: 1,
      antialias: false,
    });
    const backgroundVisible = this.canvasEngine.backgroundSprite?.visible !== false;
    const layerStates = layers.map((layer) => ({
      layer,
      visible: layer.container.visible,
    }));
    const documentPosition = {
      x: documentContainer.x ?? 0,
      y: documentContainer.y ?? 0,
    };

    for (const [index, entry] of layerStates.entries()) {
      entry.layer.container.visible = entry.visible && index < layerIndex;
    }

    try {
      documentContainer.position.set(0, 0);
      if (this.canvasEngine.backgroundSprite) {
        this.canvasEngine.backgroundSprite.visible = backgroundVisible;
      }
      renderer.render({
        container: documentContainer,
        target: texture,
        clear: true,
      });

      return texture;
    } catch {
      texture.destroy(true);
      return null;
    } finally {
      documentContainer.position.set(documentPosition.x, documentPosition.y);
      if (this.canvasEngine.backgroundSprite) {
        this.canvasEngine.backgroundSprite.visible = backgroundVisible;
      }
      for (const entry of layerStates) {
        entry.layer.container.visible = entry.visible;
      }
    }
  }

  findLayerForObject(object) {
    if (!object) {
      return null;
    }

    return this.layerManager.getLayers().find((layer) =>
      layer.container === object ||
      layer.container === object.parent ||
      layer.container.children.includes(object)
    ) ?? null;
  }
}
