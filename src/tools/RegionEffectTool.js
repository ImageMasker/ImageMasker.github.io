import {
  cloneRegionEffectData,
  createDefaultRegionData,
  createDefaultRegionEffect,
  getRegionEffectDefinition,
  normalizeRegionEffectData,
} from './regionDefinitions.js';

const {
  BlurFilter,
  Container,
  DisplacementFilter,
  Graphics,
  NoiseFilter,
  Rectangle,
  RenderTexture,
  Sprite,
} = PIXI;

const COMMUNITY_FILTERS = PIXI.filters ?? {};
const MIN_REGION_SIZE = 10;
const DEFAULT_DISPLACEMENT_MAP_SIZE = 128;

export class RegionEffectTool {
  constructor(canvasEngine, layerManager, eventBus) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.count = 0;
    this.creationOptions = createDefaultRegionData();
    this.drawState = null;
    this.previewOverlay = new Container();
    this.previewOverlay.visible = false;
    this.canvasEngine.overlayContainer.addChild(this.previewOverlay);

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

    this.eventBus.on('object:changed', ({ object }) => {
      this.handleObjectStackChange(object);
    });

    this.eventBus.on('object:transformed', ({ object }) => {
      this.handleObjectStackChange(object);
    });

    this.eventBus.on('objects:transformed', ({ entries }) => {
      const seenObjects = new Set();

      for (const entry of entries ?? []) {
        const object = entry?.object;

        if (!object || seenObjects.has(object)) {
          continue;
        }

        seenObjects.add(object);
        this.handleObjectStackChange(object);
      }
    });

    this.eventBus.on('export:start', () => {
      this.refreshAll();
    });

    this.eventBus.on('export:complete', () => {
      this.refreshAll();
    });
  }

  activate() {
    this.canvasEngine.app.canvas.style.cursor = 'crosshair';
  }

  deactivate() {
    this.canvasEngine.app.canvas.style.cursor = 'default';
    this.drawState = null;
    this.clearPreview();
  }

  setCreationOptions(partialOptions = {}) {
    this.creationOptions = this.mergeRegionData(this.creationOptions, partialOptions);
  }

  getCreationOptions() {
    return cloneRegionEffectData(this.creationOptions);
  }

  onPointerDown(event) {
    if (!this.canvasEngine.sourceImageElement) {
      return;
    }

    const shapeType = this.creationOptions.shape.type;

    this.drawState = {
      shapeType,
      startX: event.canvasX,
      startY: event.canvasY,
      points: [{ x: event.canvasX, y: event.canvasY }],
      currentX: event.canvasX,
      currentY: event.canvasY,
    };

    this.updatePreview();
  }

  onPointerMove(event) {
    if (!this.drawState) {
      return;
    }

    this.drawState.currentX = event.canvasX;
    this.drawState.currentY = event.canvasY;

    if (this.drawState.shapeType === 'freehand') {
      const lastPoint = this.drawState.points[this.drawState.points.length - 1];
      const nextPoint = {
        x: event.canvasX,
        y: event.canvasY,
      };

      if (!lastPoint || Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) >= 3) {
        this.drawState.points.push(nextPoint);
      }
    }

    this.updatePreview();
  }

  onPointerUp(event) {
    if (!this.drawState) {
      return;
    }

    this.drawState.currentX = event.canvasX;
    this.drawState.currentY = event.canvasY;

    const regionData = this.buildRegionFromDrawState();

    this.drawState = null;
    this.clearPreview();

    if (!regionData) {
      return;
    }

    const result = this.addRegion(regionData);
    this.eventBus.emit('region:created', result);
  }

  addRegion(partialData = {}) {
    const regionData = this.mergeRegionData(this.creationOptions, partialData);
    const effectLabel = getRegionEffectDefinition(regionData.effect.type).label;
    const layerId = this.layerManager.addLayer(
      `${effectLabel} region ${++this.count}`,
      'effect-region'
    );
    const layer = this.layerManager.getLayer(layerId);
    const object = this.createRegionObject({
      ...regionData,
      x: partialData?.x,
      y: partialData?.y,
    });

    layer.container.addChild(object);
    this.layerManager.setActiveLayer(layerId);
    this.refreshRegion(object);

    return {
      layer,
      object,
    };
  }

  createRegionObject(partialData = {}) {
    const regionData = normalizeRegionEffectData(partialData);
    const object = new Container();
    const positionX = Number.isFinite(Number(partialData?.x))
      ? Number(partialData.x)
      : this.canvasEngine.canvasWidth / 2;
    const positionY = Number.isFinite(Number(partialData?.y))
      ? Number(partialData.y)
      : this.canvasEngine.canvasHeight / 2;

    object.position.set(positionX, positionY);
    object.eventMode = 'static';
    object.cursor = 'pointer';
    object.alpha = 1;
    object.blendMode = regionData.blendMode ?? 'normal';
    object.__toolType = 'effect-region';
    object.__regionEffectData = regionData;
    object.__regionRuntime = {
      previewSprite: null,
      previewTexture: null,
    };

    return object;
  }

  cloneRegionObject(object) {
    if (!object || object.__toolType !== 'effect-region') {
      return null;
    }

    const clone = this.createRegionObject(cloneRegionEffectData(object.__regionEffectData));

    clone.scale.copyFrom(object.scale);
    clone.rotation = object.rotation;
    clone.alpha = object.alpha;
    clone.blendMode = object.blendMode ?? clone.__regionEffectData.blendMode ?? 'normal';
    this.refreshRegion(clone);

    return clone;
  }

  updateRegionEffect(object, partialData) {
    if (!object || object.__toolType !== 'effect-region') {
      return;
    }

    object.__regionEffectData = this.mergeRegionData(object.__regionEffectData, partialData);
    object.blendMode = object.__regionEffectData.blendMode ?? 'normal';
    this.eventBus.emit('object:changed', { object });
  }

  refreshAll() {
    const layers = this.layerManager
      .getLayers()
      .filter((layer) => layer.type === 'effect-region');

    for (const layer of layers) {
      const object = this.layerManager.getPrimaryContentObject(layer);

      if (object?.__toolType === 'effect-region') {
        this.refreshRegion(object);
      }
    }
  }

  handleObjectStackChange(object) {
    if (!object) {
      return;
    }

    const layer = this.findLayerForObject(object);

    if (!layer) {
      return;
    }

    if (object.__toolType === 'effect-region') {
      this.refreshRegion(object);
      this.refreshRegionsAboveLayer(layer.id, object);
      return;
    }

    this.refreshRegionsAboveLayer(layer.id);
  }

  refreshRegion(object) {
    if (!object || object.__toolType !== 'effect-region' || !this.canvasEngine.backgroundSprite) {
      return;
    }

    const regionData = normalizeRegionEffectData(object.__regionEffectData);
    object.__regionEffectData = regionData;
    object.blendMode = regionData.blendMode ?? 'normal';

    const preview = this.renderRegionTexture(object, regionData);

    if (!preview) {
      return;
    }

    const runtime = object.__regionRuntime ?? {
      previewSprite: null,
      previewTexture: null,
    };
    const previousTexture = runtime.previewTexture;
    const previousSprite = runtime.previewSprite;
    const previewSprite = new Sprite(preview.texture);

    previewSprite.anchor.set(0.5);
    previewSprite.position.set(0, 0);
    previewSprite.width = preview.width;
    previewSprite.height = preview.height;
    previewSprite.eventMode = 'none';

    if (previousSprite?.parent === object) {
      object.removeChild(previousSprite);
    }

    if (previousSprite) {
      previousSprite.destroy();
    }

    object.addChild(previewSprite);
    object.boundsArea = new Rectangle(
      -preview.width / 2,
      -preview.height / 2,
      preview.width,
      preview.height
    );

    runtime.previewSprite = previewSprite;
    runtime.previewTexture = preview.texture;
    runtime.previewSize = {
      width: preview.width,
      height: preview.height,
    };
    object.__regionRuntime = runtime;

    if (previousTexture) {
      previousTexture.destroy(true);
    }
  }

  findLayerForObject(object) {
    if (!object) {
      return null;
    }

    return this.layerManager.getLayers().find((layer) =>
      layer.container === object ||
      layer.container === object.parent || layer.container.children.includes(object)
    ) ?? null;
  }

  refreshRegionsAboveLayer(layerId, excludeObject = null) {
    const layers = this.layerManager.getLayers();
    const layerIndex = layers.findIndex((layer) => layer.id === layerId);

    if (layerIndex === -1) {
      return;
    }

    for (let index = layerIndex + 1; index < layers.length; index += 1) {
      const layer = layers[index];

      if (layer.type !== 'effect-region') {
        continue;
      }

      const object = this.layerManager.getPrimaryContentObject(layer);

      if (object?.__toolType === 'effect-region' && object !== excludeObject) {
        this.refreshRegion(object);
      }
    }
  }

  renderRegionTexture(object, regionData) {
    const renderer = this.canvasEngine.app?.renderer;
    const sourceTexture = this.renderSourceTextureForRegion(object);

    if (!renderer || !sourceTexture) {
      return null;
    }

    const shapeBounds = this.getShapeBounds(regionData.shape);
    const previewWidth = Math.max(8, Math.round(shapeBounds.width));
    const previewHeight = Math.max(8, Math.round(shapeBounds.height));
    const maxTextureSize = this.getMaxTextureSize();
    const renderScale = Math.min(
      1,
      maxTextureSize / previewWidth,
      maxTextureSize / previewHeight
    );
    const renderWidth = Math.max(8, Math.round(previewWidth * renderScale));
    const renderHeight = Math.max(8, Math.round(previewHeight * renderScale));
    const resolutionScaleX = renderWidth / previewWidth;
    const resolutionScaleY = renderHeight / previewHeight;
    const rootScaleX = Math.max(Math.abs(object.scale.x || 1), 0.0001);
    const rootScaleY = Math.max(Math.abs(object.scale.y || 1), 0.0001);
    const cleanup = [];
    const contentScaleX = (regionData.content.reflectX ? -1 : 1)
      * regionData.content.magnify
      / rootScaleX
      * resolutionScaleX;
    const contentScaleY = (regionData.content.reflectY ? -1 : 1)
      * regionData.content.magnify
      / rootScaleY
      * resolutionScaleY;
    const frame = new Container();
    const renderLayer = new Container();
    const contentTransform = new Container();
    const contentSprite = new Sprite(sourceTexture);
    const maskGraphic = this.createMaskGraphic(regionData.shape, shapeBounds, {
      x: renderWidth / 2,
      y: renderHeight / 2,
      scaleX: resolutionScaleX,
      scaleY: resolutionScaleY,
    });

    contentTransform.position.set(renderWidth / 2, renderHeight / 2);
    contentTransform.scale.set(contentScaleX, contentScaleY);
    contentTransform.rotation = regionData.content.rotation * (Math.PI / 180);

    contentSprite.width = this.canvasEngine.canvasWidth;
    contentSprite.height = this.canvasEngine.canvasHeight;
    contentSprite.position.set(-object.x, -object.y);

    contentTransform.addChild(contentSprite);
    renderLayer.addChild(contentTransform);
    frame.addChild(renderLayer);
    frame.addChild(maskGraphic);
    renderLayer.mask = maskGraphic;
    renderLayer.filters = this.buildFilters(regionData, renderWidth, renderHeight, frame, cleanup);
    renderLayer.filterArea = new Rectangle(0, 0, renderWidth, renderHeight);

    const texture = RenderTexture.create({
      width: renderWidth,
      height: renderHeight,
      resolution: 1,
      antialias: false,
    });

    try {
      renderer.render({
        container: frame,
        target: texture,
        clear: true,
      });
    } finally {
      sourceTexture.destroy(true);
      cleanup.forEach((resource) => {
        resource.parent?.removeChild(resource);
        resource.destroy({ texture: true, textureSource: true });
      });
      frame.destroy({ children: true });
    }

    return {
      texture,
      width: previewWidth,
      height: previewHeight,
    };
  }

  renderSourceTextureForRegion(object) {
    const renderer = this.canvasEngine.app?.renderer;
    const documentContainer = this.canvasEngine.documentContainer;
    const backgroundSprite = this.canvasEngine.backgroundSprite;
    const regionLayer = this.findLayerForObject(object);
    const layers = this.layerManager.getLayers();
    const regionLayerIndex = regionLayer
      ? layers.findIndex((layer) => layer.id === regionLayer.id)
      : -1;

    if (!renderer || !documentContainer || !backgroundSprite || regionLayerIndex === -1) {
      return null;
    }

    const texture = RenderTexture.create({
      width: this.canvasEngine.canvasWidth,
      height: this.canvasEngine.canvasHeight,
      resolution: 1,
      antialias: false,
    });
    const layerStates = layers.map((layer) => ({
      layer,
      visible: layer.container.visible,
    }));
    const documentPosition = {
      x: documentContainer.x ?? 0,
      y: documentContainer.y ?? 0,
    };

    for (const [index, entry] of layerStates.entries()) {
      entry.layer.container.visible = entry.visible && index < regionLayerIndex;
    }

    try {
      documentContainer.position.set(0, 0);
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
      for (const entry of layerStates) {
        entry.layer.container.visible = entry.visible;
      }
    }
  }

  buildFilters(regionData, width, height, frame, cleanup = []) {
    const effect = regionData.effect ?? {};
    const amount = Number(effect.amount) || 0;
    const radius = Math.max(8, Number(effect.radius) || Math.min(width, height) / 2);
    const center = {
      x: width / 2,
      y: height / 2,
    };

    switch (effect.type) {
      case 'none':
        return null;
      case 'blur': {
        const filter = new BlurFilter();
        filter.strength = Math.max(0, amount / 2);
        return [filter];
      }
      case 'pixelate': {
        const FilterClass = COMMUNITY_FILTERS.PixelateFilter;

        if (!FilterClass) {
          return null;
        }

        const filter = new FilterClass(Math.max(1, Math.round(amount)));
        return [filter];
      }
      case 'twist': {
        const FilterClass = COMMUNITY_FILTERS.TwistFilter;

        if (!FilterClass) {
          return null;
        }

        const filter = new FilterClass({
          radius,
          angle: (amount / 100) * 8,
          offset: center,
        });
        return [filter];
      }
      case 'bulgePinch': {
        const FilterClass = COMMUNITY_FILTERS.BulgePinchFilter;

        if (!FilterClass) {
          return null;
        }

        const filter = new FilterClass({
          radius,
          strength: Math.max(0, Math.min(1, amount / 100)),
          center: { x: 0.5, y: 0.5 },
        });
        return [filter];
      }
      case 'zoomBlur': {
        const FilterClass = COMMUNITY_FILTERS.ZoomBlurFilter;

        if (!FilterClass) {
          return null;
        }

        const filter = new FilterClass({
          strength: Math.max(0, amount / 300),
          center,
          innerRadius: 0,
          radius,
        });
        return [filter];
      }
      case 'radialBlur': {
        const FilterClass = COMMUNITY_FILTERS.RadialBlurFilter;

        if (!FilterClass) {
          return null;
        }

        const filter = new FilterClass({
          angle: amount * 0.6,
          center,
          radius,
          kernelSize: 5,
        });
        return [filter];
      }
      case 'rgbSplit': {
        const FilterClass = COMMUNITY_FILTERS.RGBSplitFilter;

        if (!FilterClass) {
          return null;
        }

        const spread = Math.max(1, amount);
        const filter = new FilterClass({
          red: { x: -spread, y: 0 },
          green: { x: 0, y: spread / 2 },
          blue: { x: spread, y: 0 },
        });
        return [filter];
      }
      case 'noise': {
        const filter = new NoiseFilter();
        filter.noise = Math.min(1, amount / 100);
        filter.seed = Number(effect.seed) || Math.random();
        return [filter];
      }
      case 'displacement': {
        const displacementSprite = this.createDisplacementSprite(
          Number(effect.seed) || Math.random(),
          width,
          height
        );

        displacementSprite.renderable = false;
        displacementSprite.alpha = 0;
        frame.addChild(displacementSprite);
        cleanup.push(displacementSprite);

        const filter = new DisplacementFilter({
          sprite: displacementSprite,
          scale: {
            x: amount,
            y: amount,
          },
        });
        return [filter];
      }
      default:
        return null;
    }
  }

  createMaskGraphic(shape, shapeBounds, placement) {
    const graphic = new Graphics();
    const centerX = placement.x;
    const centerY = placement.y;
    const scaleX = placement.scaleX ?? 1;
    const scaleY = placement.scaleY ?? 1;

    if (shape.type === 'circle') {
      graphic
        .circle(centerX, centerY, shape.radius * scaleX)
        .fill(0xffffff);

      return graphic;
    }

    if (shape.type === 'freehand') {
      const translatedPoints = shape.points.map((point) => ({
        x: centerX + point.x * scaleX,
        y: centerY + point.y * scaleY,
      }));

      graphic.poly(translatedPoints.flatMap((point) => [point.x, point.y])).fill(0xffffff);
      return graphic;
    }

    graphic
      .rect(
        centerX - (shape.width * scaleX) / 2,
        centerY - (shape.height * scaleY) / 2,
        shape.width * scaleX,
        shape.height * scaleY
      )
      .fill(0xffffff);

    return graphic;
  }

  buildRegionFromDrawState() {
    if (!this.drawState) {
      return null;
    }

    const shapeType = this.drawState.shapeType;

    if (shapeType === 'circle') {
      const radius = Math.hypot(
        this.drawState.currentX - this.drawState.startX,
        this.drawState.currentY - this.drawState.startY
      );

      if (radius < MIN_REGION_SIZE) {
        return null;
      }

      return this.mergeRegionData(this.creationOptions, {
        shape: {
          type: 'circle',
          radius,
        },
      }, {
        x: this.drawState.startX,
        y: this.drawState.startY,
      });
    }

    if (shapeType === 'freehand') {
      const points = this.simplifyPoints(this.drawState.points);

      if (points.length < 3) {
        return null;
      }

      const bounds = this.getPointsBounds(points);

      if (bounds.width < MIN_REGION_SIZE || bounds.height < MIN_REGION_SIZE) {
        return null;
      }

      return this.mergeRegionData(this.creationOptions, {
        shape: {
          type: 'freehand',
          points: points.map((point) => ({
            x: point.x - bounds.centerX,
            y: point.y - bounds.centerY,
          })),
        },
      }, {
        x: bounds.centerX,
        y: bounds.centerY,
      });
    }

    const width = Math.abs(this.drawState.currentX - this.drawState.startX);
    const height = Math.abs(this.drawState.currentY - this.drawState.startY);

    if (width < MIN_REGION_SIZE || height < MIN_REGION_SIZE) {
      return null;
    }

    return this.mergeRegionData(this.creationOptions, {
      shape: {
        type: 'rect',
        width,
        height,
      },
    }, {
      x: (this.drawState.startX + this.drawState.currentX) / 2,
      y: (this.drawState.startY + this.drawState.currentY) / 2,
    });
  }

  mergeRegionData(baseData, partialData = {}, positionOverride = null) {
    const base = createDefaultRegionData(baseData);
    const baseShapeType = typeof baseData?.shape?.type === 'string'
      ? baseData.shape.type
      : base.shape.type;
    const nextShapeType = partialData?.shape?.type ?? baseShapeType;
    const nextEffectType = partialData?.effect?.type ?? base.effect.type;
    const merged = normalizeRegionEffectData({
      shape: {
        ...base.shape,
        ...(partialData.shape ?? {}),
        type: nextShapeType,
      },
      content: {
        ...base.content,
        ...(partialData.content ?? {}),
      },
      effect: createDefaultRegionEffect(nextEffectType, {
        ...base.effect,
        ...(partialData.effect ?? {}),
        type: nextEffectType,
      }),
      blendMode: partialData.blendMode ?? base.blendMode,
    });
    const baseShapePoints = Array.isArray(baseData?.shape?.points)
      ? baseData.shape.points
      : Array.isArray(base.shape?.points)
        ? base.shape.points
        : [];
    const nextShapePoints = Array.isArray(partialData?.shape?.points)
      ? partialData.shape.points
      : baseShapePoints;

    if (nextShapeType === 'freehand') {
      merged.shape = {
        type: 'freehand',
        points: nextShapePoints
          .map((point) => ({
            x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 0,
            y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 0,
          }))
          .filter((point, index, source) => {
            if (index === 0) {
              return true;
            }

            const previous = source[index - 1];
            return previous.x !== point.x || previous.y !== point.y;
          }),
      };
    }

    if (!positionOverride) {
      return merged;
    }

    return {
      ...merged,
      x: positionOverride.x,
      y: positionOverride.y,
    };
  }

  updatePreview() {
    if (!this.drawState) {
      this.clearPreview();
      return;
    }

    this.previewOverlay.removeChildren().forEach((child) => child.destroy());

    const fill = new Graphics();
    const stroke = new Graphics();

    if (this.drawState.shapeType === 'circle') {
      const startPoint = this.previewPointFromDocumentPoint(
        this.drawState.startX,
        this.drawState.startY
      );
      const currentPoint = this.previewPointFromDocumentPoint(
        this.drawState.currentX,
        this.drawState.currentY
      );
      const radius = Math.hypot(
        currentPoint.x - startPoint.x,
        currentPoint.y - startPoint.y
      );

      fill.circle(startPoint.x, startPoint.y, radius).fill({
        color: 0xffa155,
        alpha: 0.12,
      });
      stroke.circle(startPoint.x, startPoint.y, radius).stroke({
        color: 0xffa155,
        width: 2,
      });
    } else if (this.drawState.shapeType === 'freehand') {
      const points = this.drawState.points.map((point) =>
        this.previewPointFromDocumentPoint(point.x, point.y)
      );

      if (points.length >= 2) {
        const flat = points.flatMap((point) => [point.x, point.y]);
        fill.poly(flat).fill({
          color: 0xffa155,
          alpha: 0.12,
        });
        stroke.poly(flat).stroke({
          color: 0xffa155,
          width: 2,
        });
      }
    } else {
      const startPoint = this.previewPointFromDocumentPoint(
        this.drawState.startX,
        this.drawState.startY
      );
      const currentPoint = this.previewPointFromDocumentPoint(
        this.drawState.currentX,
        this.drawState.currentY
      );
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);

      fill.rect(x, y, width, height).fill({
        color: 0xffa155,
        alpha: 0.12,
      });
      stroke.rect(x, y, width, height).stroke({
        color: 0xffa155,
        width: 2,
      });
    }

    this.previewOverlay.addChild(fill);
    this.previewOverlay.addChild(stroke);
    this.previewOverlay.visible = true;
  }

  previewPointFromDocumentPoint(x, y) {
    return this.canvasEngine.documentToGlobalPoint(x, y);
  }

  clearPreview() {
    this.previewOverlay.removeChildren().forEach((child) => child.destroy());
    this.previewOverlay.visible = false;
  }

  simplifyPoints(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return [];
    }

    const simplified = [points[0]];

    for (let index = 1; index < points.length; index += 1) {
      const previous = simplified[simplified.length - 1];
      const point = points[index];

      if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 4) {
        simplified.push(point);
      }
    }

    if (simplified.length >= 3) {
      const last = simplified[simplified.length - 1];
      const first = simplified[0];

      if (Math.hypot(last.x - first.x, last.y - first.y) < 4) {
        simplified.pop();
      }
    }

    return simplified;
  }

  getPointsBounds(points) {
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }

  getShapeBounds(shape) {
    if (shape.type === 'circle') {
      return {
        x: -shape.radius,
        y: -shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    }

    if (shape.type === 'freehand') {
      const minX = Math.min(...shape.points.map((point) => point.x));
      const minY = Math.min(...shape.points.map((point) => point.y));
      const maxX = Math.max(...shape.points.map((point) => point.x));
      const maxY = Math.max(...shape.points.map((point) => point.y));

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    return {
      x: -shape.width / 2,
      y: -shape.height / 2,
      width: shape.width,
      height: shape.height,
    };
  }

  createDisplacementSprite(seed, width, height) {
    const canvas = document.createElement('canvas');
    const mapSize = DEFAULT_DISPLACEMENT_MAP_SIZE;

    canvas.width = mapSize;
    canvas.height = mapSize;

    const context = canvas.getContext('2d');

    if (!context) {
      return new Sprite(PIXI.Texture.from(canvas));
    }

    const imageData = context.createImageData(mapSize, mapSize);
    const random = this.createSeededRandom(seed);

    for (let index = 0; index < imageData.data.length; index += 4) {
      const value = Math.floor(random() * 255);
      imageData.data[index] = value;
      imageData.data[index + 1] = Math.floor(random() * 255);
      imageData.data[index + 2] = 255 - value;
      imageData.data[index + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);

    const sprite = new Sprite(PIXI.Texture.from(canvas));

    sprite.position.set(0, 0);
    sprite.width = width;
    sprite.height = height;

    return sprite;
  }

  createSeededRandom(seed) {
    let value = Math.floor((seed ?? 0.5) * 2147483647) || 1;

    return () => {
      value = (value * 48271) % 2147483647;
      return value / 2147483647;
    };
  }

  getMaxTextureSize() {
    const gl = this.canvasEngine.app?.renderer?.gl;

    if (gl?.MAX_TEXTURE_SIZE) {
      try {
        return Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      } catch {
        return 4096;
      }
    }

    return 4096;
  }
}
