import { hexToRgb } from '../utils/color.js';

const { Sprite, Texture } = PIXI;

export class BrushTool {
  constructor(canvasEngine, layerManager, eventBus, options = {}) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.strokeType = options.strokeType ?? 'brush';
    this.cursor = options.cursor ?? 'crosshair';
    this.width = options.width ?? 10;
    this.color = options.color ?? '#000000';
    this.opacity = options.opacity ?? 1;
    this.brushType = options.brushType ?? 'smooth';
    this.pointSpacing = options.pointSpacing ?? 2.5;
    this.minPointDistance = options.minPointDistance ?? 0.6;
    this.sharedState = options.sharedState ?? {
      layerStates: {},
    };
    this.currentStroke = null;

    this.eventBus.on('image:loaded', ({ preserveScene } = {}) => {
      if (preserveScene) {
        this.refreshSurface();
        this.ensureSurface();
        return;
      }

      this.clear();
      this.ensureSurface();
    });

    this.eventBus.on('export:start', () => {
      this.refreshSurface();
    });

    this.eventBus.on('export:complete', () => {
      this.refreshSurface();
    });
  }

  activate() {
    this.canvasEngine.app.canvas.style.cursor = this.cursor;
    this.ensureSurface();
  }

  deactivate() {
    this.currentStroke = null;
  }

  setWidth(width) {
    this.width = Math.max(1, Math.min(50, Number(width)));
  }

  getWidth() {
    return this.width;
  }

  setColor(color) {
    this.color = color;
  }

  getColor() {
    return this.color;
  }

  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, Number(opacity)));
  }

  getOpacity() {
    return this.opacity;
  }

  setBrushType(brushType) {
    this.brushType = ['smooth', 'marker', 'dotted', 'spray'].includes(brushType)
      ? brushType
      : 'smooth';
  }

  getBrushType() {
    return this.brushType;
  }

  clear() {
    const layerStates = this.getAllLayerStates();

    for (const [layerId, layerState] of Object.entries(layerStates)) {
      layerState.strokes = [];
      this.emitPaintChanged(layerId);
    }

    this.currentStroke = null;
    this.refreshSurface();
  }

  onPointerDown(event) {
    if (!this.canvasEngine.imgWidth || !this.canvasEngine.imgHeight) {
      return;
    }

    const targetLayer = this.resolveTargetLayer();

    if (!targetLayer) {
      return;
    }

    this.ensureSurface(targetLayer.id);
    this.currentStroke = {
      tool: this.strokeType,
      brushType: this.brushType,
      layerId: targetLayer.id,
      points: [{ x: event.canvasX, y: event.canvasY }],
      width: this.width,
      color: this.color,
      opacity: this.opacity,
      seed: Math.floor(Math.random() * 0x7fffffff),
      baseWidth: this.canvasEngine.canvasWidth,
      baseHeight: this.canvasEngine.canvasHeight,
    };
  }

  onPointerMove(event) {
    if (!this.currentStroke) {
      return;
    }

    const previousPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
    const nextPoint = { x: event.canvasX, y: event.canvasY };
    const distance = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);

    if (distance < this.minPointDistance) {
      return;
    }

    const appendedPoints = this.buildInterpolatedPoints(previousPoint, nextPoint, this.currentStroke.width);

    for (const point of appendedPoints) {
      this.currentStroke.points.push(point);
      this.renderStrokeSegment(this.currentStroke);
    }
  }

  onPointerUp() {
    if (!this.currentStroke) {
      return;
    }

    if (this.currentStroke.points.length === 1) {
      this.renderStrokeSegment(this.currentStroke);
    }

    const layerState = this.getLayerState(this.currentStroke.layerId);
    layerState.strokes.push(this.currentStroke);
    this.refreshSurface(this.currentStroke.layerId);
    this.emitPaintChanged(this.currentStroke.layerId);
    this.eventBus.emit('stroke:committed', {
      stroke: this.currentStroke,
    });
    this.currentStroke = null;
  }

  addStroke(stroke, index = this.getLayerStrokes(stroke.layerId).length) {
    const layerState = this.getLayerState(stroke.layerId);
    const clampedIndex = Math.max(0, Math.min(index, layerState.strokes.length));
    layerState.strokes.splice(clampedIndex, 0, stroke);
    this.refreshSurface(stroke.layerId);
    this.emitPaintChanged(stroke.layerId);
  }

  removeStroke(stroke) {
    const layerState = this.getLayerState(stroke.layerId);
    const index = layerState.strokes.indexOf(stroke);

    if (index === -1) {
      return -1;
    }

    layerState.strokes.splice(index, 1);
    this.refreshSurface(stroke.layerId);
    this.emitPaintChanged(stroke.layerId);
    return index;
  }

  getLayerStrokes(layerId) {
    return [...this.getLayerState(layerId).strokes];
  }

  restoreLayerStrokes(layerId, strokes = []) {
    const layerState = this.getLayerState(layerId);
    layerState.strokes = Array.isArray(strokes) ? strokes : [];
    this.refreshSurface(layerId);
    this.emitPaintChanged(layerId);
  }

  getSurfaceLayerId() {
    return this.resolveTargetLayer()?.id ?? null;
  }

  ensureSurface(layerId = this.getSurfaceLayerId()) {
    if (!layerId || !this.canvasEngine.app) {
      return;
    }

    const layer = this.layerManager.getLayer(layerId);

    if (!layer) {
      return;
    }

    const layerState = this.getLayerState(layerId);
    const displayWidth = Math.max(
      1,
      Math.round(this.canvasEngine.canvasWidth || this.canvasEngine.app.renderer.width || 1)
    );
    const displayHeight = Math.max(
      1,
      Math.round(this.canvasEngine.canvasHeight || this.canvasEngine.app.renderer.height || 1)
    );
    const textureWidth = Math.max(1, Math.round(this.canvasEngine.app.renderer.width));
    const textureHeight = Math.max(1, Math.round(this.canvasEngine.app.renderer.height));
    const resized = this.ensureBackingStore(layerState, textureWidth, textureHeight);

    if (!layerState.sprite) {
      layerState.texture = Texture.from(layerState.offscreenCanvas);
      layerState.sprite = new Sprite(layerState.texture);
      layerState.sprite.eventMode = 'none';
      layerState.sprite.cursor = 'default';
      layerState.sprite.__toolType = 'brush-surface';
      layerState.sprite.width = displayWidth;
      layerState.sprite.height = displayHeight;
      this.attachSurfaceSprite(layer, layerState.sprite);
      return;
    }

    layerState.sprite.width = displayWidth;
    layerState.sprite.height = displayHeight;
    this.attachSurfaceSprite(layer, layerState.sprite);

    if (resized) {
      this.refreshSurface(layerId);
    }
  }

  refreshSurface(layerId = null) {
    if (!this.canvasEngine.app) {
      return;
    }

    if (layerId) {
      this.refreshLayerSurface(layerId);
      return;
    }

    for (const currentLayerId of Object.keys(this.getAllLayerStates())) {
      this.refreshLayerSurface(currentLayerId);
    }
  }

  refreshLayerSurface(layerId) {
    const layer = this.layerManager.getLayer(layerId);

    if (!layer) {
      return;
    }

    const layerState = this.getLayerState(layerId);
    const textureWidth = Math.max(1, Math.round(this.canvasEngine.app.renderer.width));
    const textureHeight = Math.max(1, Math.round(this.canvasEngine.app.renderer.height));

    this.ensureBackingStore(layerState, textureWidth, textureHeight);

    if (!layerState.sprite) {
      layerState.texture = Texture.from(layerState.offscreenCanvas);
      layerState.sprite = new Sprite(layerState.texture);
      layerState.sprite.eventMode = 'none';
      layerState.sprite.cursor = 'default';
      layerState.sprite.__toolType = 'brush-surface';
    }

    this.attachSurfaceSprite(layer, layerState.sprite);
    layerState.sprite.width = this.canvasEngine.canvasWidth || textureWidth;
    layerState.sprite.height = this.canvasEngine.canvasHeight || textureHeight;
    layerState.offscreenContext.clearRect(
      0,
      0,
      layerState.offscreenCanvas.width,
      layerState.offscreenCanvas.height
    );

    for (const stroke of layerState.strokes) {
      this.drawStrokeOnContext(layerState, stroke);
    }

    this.syncTexture(layerState);
  }

  renderStrokeSegment(stroke) {
    const layerState = this.getLayerState(stroke.layerId);

    if (!layerState.offscreenContext) {
      this.ensureSurface(stroke.layerId);
    }

    this.drawStrokeOnContext(layerState, stroke, true);
    this.syncTexture(layerState);
  }

  buildInterpolatedPoints(previousPoint, nextPoint, width) {
    const distance = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
    const spacing = Math.max(this.pointSpacing, width * 0.25);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    const points = [];

    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      points.push({
        x: previousPoint.x + (nextPoint.x - previousPoint.x) * ratio,
        y: previousPoint.y + (nextPoint.y - previousPoint.y) * ratio,
      });
    }

    return points;
  }

  drawStrokeOnContext(layerState, stroke, incremental = false) {
    if (!layerState?.offscreenContext || !layerState.offscreenCanvas) {
      return;
    }

    const context = layerState.offscreenContext;
    const scaleX = layerState.offscreenCanvas.width / stroke.baseWidth;
    const scaleY = layerState.offscreenCanvas.height / stroke.baseHeight;

    context.save();
    context.scale(scaleX, scaleY);

    if (stroke.tool === 'erase') {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = stroke.width;
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = 'rgba(0,0,0,1)';
      context.fillStyle = 'rgba(0,0,0,1)';
      this.drawContinuousStroke(context, stroke, stroke.width, incremental);
      context.restore();
      return;
    }

    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = hexToRgb(stroke.color, stroke.opacity);
    context.fillStyle = hexToRgb(stroke.color, stroke.opacity);

    const brushType = stroke.brushType ?? 'smooth';

    if (brushType === 'marker') {
      context.lineCap = 'square';
      context.lineJoin = 'bevel';
      context.lineWidth = stroke.width * 1.3;
      this.drawContinuousStroke(context, stroke, stroke.width * 1.3, incremental);
      context.restore();
      return;
    }

    if (brushType === 'dotted') {
      this.drawDottedStroke(context, stroke, stroke.width, incremental);
      context.restore();
      return;
    }

    if (brushType === 'spray') {
      this.drawSprayStroke(context, stroke, stroke.width, incremental);
      context.restore();
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = stroke.width;
    this.drawContinuousStroke(context, stroke, stroke.width, incremental);
    context.restore();
  }

  drawContinuousStroke(context, stroke, width, incremental) {
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      context.beginPath();
      context.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }

    if (incremental && stroke.points.length >= 3) {
      const points = stroke.points;
      const p0 = points[points.length - 3];
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      const start = this.midpoint(p0, p1);
      const end = this.midpoint(p1, p2);

      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(
        p1.x,
        p1.y,
        end.x,
        end.y
      );
      context.stroke();
      return;
    }

    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);

    if (stroke.points.length === 2) {
      context.lineTo(stroke.points[1].x, stroke.points[1].y);
      context.stroke();
      return;
    }

    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const current = stroke.points[index];
      const next = stroke.points[index + 1];
      const midpoint = this.midpoint(current, next);

      context.quadraticCurveTo(
        current.x,
        current.y,
        midpoint.x,
        midpoint.y
      );
    }

    const lastPoint = stroke.points[stroke.points.length - 1];
    context.lineTo(lastPoint.x, lastPoint.y);
    context.stroke();
  }

  drawDottedStroke(context, stroke, width, incremental) {
    const points = incremental
      ? stroke.points.slice(stroke.points.length > 2 ? -1 : -2)
      : stroke.points.filter((_, index) => index === 0 || index === stroke.points.length - 1 || index % Math.max(1, Math.round(stroke.width / 5)) === 0);
    const radius = Math.max(1, width * 0.4);

    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  drawSprayStroke(context, stroke, width, incremental) {
    const pointEntries = incremental
      ? stroke.points
        .slice(stroke.points.length > 2 ? -1 : -2)
        .map((point, offset) => ({
          point,
          index: stroke.points.length > 2
            ? stroke.points.length - 1 + offset
            : stroke.points.length - 2 + offset,
        }))
      : stroke.points.map((point, index) => ({ point, index }));
    const sprayRadius = Math.max(1, width * 0.9);
    const dropletCount = Math.max(8, Math.round(stroke.width * 1.4));

    for (const entry of pointEntries) {
      const random = this.createSeededRandom((stroke.seed ?? 1) ^ ((entry.index + 1) * 2654435761));

      for (let dropletIndex = 0; dropletIndex < dropletCount; dropletIndex += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * sprayRadius;
        const radius = Math.max(0.8, width * (0.06 + random() * 0.12));
        const x = entry.point.x + Math.cos(angle) * distance;
        const y = entry.point.y + Math.sin(angle) * distance;

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  createSeededRandom(seed) {
    let current = seed >>> 0;

    return () => {
      current = (1664525 * current + 1013904223) >>> 0;
      return current / 0x100000000;
    };
  }

  midpoint(pointA, pointB) {
    return {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    };
  }

  resolveTargetLayer() {
    const activeLayer = this.layerManager.getActiveLayer();

    if (this.canPaintLayer(activeLayer)) {
      return activeLayer;
    }

    const fallbackLayer = this.layerManager.getDrawingLayer();
    return this.canPaintLayer(fallbackLayer) ? fallbackLayer : null;
  }

  canPaintLayer(layer) {
    return Boolean(layer && layer.visible !== false && layer.locked !== true && layer.type !== 'paint-effect');
  }

  attachSurfaceSprite(layer, sprite) {
    if (!layer || !sprite) {
      return;
    }

    if (!layer.container.children.includes(sprite)) {
      if (layer.type === 'drawing') {
        layer.container.addChild(sprite);
      } else {
        layer.container.addChildAt(sprite, 0);
      }
    } else if (layer.type !== 'drawing' && layer.container.getChildIndex(sprite) !== 0) {
      layer.container.setChildIndex(sprite, 0);
    }
  }

  getAllLayerStates() {
    if (!this.sharedState.layerStates) {
      this.sharedState.layerStates = {};
    }

    return this.sharedState.layerStates;
  }

  getLayerState(layerId) {
    const layerStates = this.getAllLayerStates();

    if (!layerStates[layerId]) {
      layerStates[layerId] = {
        strokes: [],
        sprite: null,
        texture: null,
        offscreenCanvas: null,
        offscreenContext: null,
      };
    }

    return layerStates[layerId];
  }

  ensureBackingStore(layerState, width, height) {
    const needsCanvas = !layerState.offscreenCanvas;
    const needsResize =
      needsCanvas ||
      layerState.offscreenCanvas.width !== width ||
      layerState.offscreenCanvas.height !== height;

    if (needsCanvas) {
      layerState.offscreenCanvas = document.createElement('canvas');
    }

    if (needsResize) {
      layerState.offscreenCanvas.width = width;
      layerState.offscreenCanvas.height = height;
      layerState.offscreenContext = layerState.offscreenCanvas.getContext('2d');
      layerState.texture?.source?.update?.();
    }

    if (!layerState.offscreenContext) {
      layerState.offscreenContext = layerState.offscreenCanvas.getContext('2d');
    }

    return needsResize;
  }

  syncTexture(layerState) {
    if (layerState?.texture?.source?.update) {
      layerState.texture.source.update();
    }
  }

  getLayerStrokeBounds(layerId) {
    const strokes = this.getLayerState(layerId).strokes;

    if (!strokes.length) {
      return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const stroke of strokes) {
      const radius = Math.max(1, Number(stroke.width) || 1) / 2;

      for (const point of stroke.points ?? []) {
        minX = Math.min(minX, point.x - radius);
        minY = Math.min(minY, point.y - radius);
        maxX = Math.max(maxX, point.x + radius);
        maxY = Math.max(maxY, point.y + radius);
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  layerHasVisibleContent(layerId) {
    const bounds = this.getLayerStrokeBounds(layerId);
    return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
  }

  cloneLayerStrokes(sourceLayerId, targetLayerId, offsetX = 0, offsetY = 0) {
    const cloned = this.getLayerStrokes(sourceLayerId).map((stroke) => ({
      ...stroke,
      layerId: targetLayerId,
      points: (stroke.points ?? []).map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      })),
    }));

    this.restoreLayerStrokes(targetLayerId, cloned);
    return cloned;
  }

  emitPaintChanged(layerId) {
    if (!layerId) {
      return;
    }

    this.eventBus.emit('layer:paint-changed', {
      layerId,
    });
  }
}
