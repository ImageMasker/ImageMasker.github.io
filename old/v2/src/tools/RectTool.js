import { hexToNumber } from '../utils/color.js';

const { Graphics } = PIXI;

export class RectTool {
  constructor(canvasEngine, layerManager) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.count = 0;
  }

  addRectangle({ color = '#000000', opacity = 1, blendMode = 'normal' } = {}) {
    const layerId = this.layerManager.addLayer(`Rectangle ${++this.count}`, 'shape');
    const layer = this.layerManager.getLayer(layerId);
    const rect = this.createRectangleGraphic({
      width: 100,
      height: 100,
      color,
      opacity,
      blendMode,
    });

    rect.position.set(
      this.canvasEngine.canvasWidth / 3,
      this.canvasEngine.canvasHeight / 3
    );

    layer.container.addChild(rect);
    this.layerManager.setActiveLayer(layerId);

    return {
      layer,
      object: rect,
    };
  }

  createRectangleGraphic({ width, height, color, opacity, blendMode = 'normal' }) {
    const rect = new Graphics();

    rect
      .rect(-width / 2, -height / 2, width, height)
      .fill({
        color: hexToNumber(color),
        alpha: opacity,
      });

    rect.eventMode = 'static';
    rect.cursor = 'pointer';
    rect.blendMode = blendMode;
    rect.__toolType = 'shape';
    rect.__shapeData = {
      kind: 'rect',
      width,
      height,
      color,
      opacity,
      blendMode,
    };

    return rect;
  }
}
