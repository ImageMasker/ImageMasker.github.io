import { BrushTool } from './BrushTool.js';

export class PaintEffectBrushTool extends BrushTool {
  constructor(canvasEngine, layerManager, eventBus, paintEffectManager, effectType, options = {}) {
    super(canvasEngine, layerManager, eventBus, {
      ...options,
      color: '#ffffff',
      brushType: 'smooth',
    });
    this.paintEffectManager = paintEffectManager;
    this.effectType = effectType;
  }

  setColor() {
    // Paint-effect brushes use the stroke alpha as a mask, not a visible color.
  }

  canPaintLayer(layer) {
    return this.paintEffectManager.isPaintEffectLayer(layer, this.effectType) &&
      layer.visible !== false &&
      layer.locked !== true;
  }

  getSurfaceLayerId() {
    const activeLayer = this.layerManager.getActiveLayer();
    return this.canPaintLayer(activeLayer) ? activeLayer.id : null;
  }

  resolveTargetLayer() {
    return this.paintEffectManager.ensureActiveEffectLayer(this.effectType, {
      opacity: this.opacity,
    });
  }
}
