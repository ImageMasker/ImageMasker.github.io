import { getCorsImageSourceCandidates } from '../integrations/CorsProxy.js';
import { loadImageElement, loadImageElementFromSources } from '../utils/image.js';

const { Sprite, Texture } = PIXI;

function clamp01(value, fallback = 1) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function clampPercent(value, fallback = 75) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, numericValue));
}

export class MaskManager {
  constructor(canvasEngine, layerManager, eventBus) {
    this.canvasEngine = canvasEngine;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.currentMask = null;
    this.currentMaskLayer = null;
    this.currentZoomValue = 50;
  }

  async loadMask(url, alphaValue = 75, origin = 'preset', zoomOverride = null, applyDeform = true) {
    if (!this.canvasEngine.imgWidth || !this.canvasEngine.imgHeight) {
      return null;
    }

    this.clearCurrentMask();
    const { sprite, layer, zoomValue, sourceUrl } = await this.createMaskLayer({
      name: `Mask ${origin}`,
      visible: true,
      locked: false,
      object: {
        maskMeta: {
          url,
          origin,
          alphaValue,
          zoomValue: zoomOverride,
          applyDeform,
        },
      },
    });

    this.eventBus.emit('mask:loaded', {
      sprite,
      layer,
      alphaValue,
      zoomValue,
      origin,
      sourceUrl,
      displayUrl: url,
    });

    return sprite;
  }

  async createMaskLayer(layerState) {
    const maskMeta = layerState?.object?.maskMeta ?? {};
    const objectState = layerState?.object ?? null;
    const url = maskMeta.url;
    const origin = maskMeta.origin ?? 'custom';
    const sourceCandidates = origin === 'preset' ? [url] : getCorsImageSourceCandidates(url);
    const { image, src: sourceUrl } = origin === 'preset'
      ? {
        image: await loadImageElement(url),
        src: url,
      }
      : await loadImageElementFromSources(sourceCandidates, {
        crossOrigin: 'anonymous',
      });
    const texture = Texture.from(image);
    const sprite = new Sprite(texture);
    const zoomValue = this.resolveZoomValue(sprite, maskMeta.zoomValue ?? null);
    const scale = 0.25 * Math.exp(0.0277 * zoomValue);
    const metaAlphaValue = clampPercent(maskMeta.alphaValue ?? 75);
    const storedLayerOpacity = Number.isFinite(Number(layerState?.opacity))
      ? clamp01(layerState.opacity)
      : null;
    const storedObjectAlpha = Number.isFinite(Number(objectState?.alpha))
      ? clamp01(objectState.alpha)
      : null;
    const maskOpacity = storedLayerOpacity !== null
      ? clamp01(storedLayerOpacity * (storedObjectAlpha ?? 1))
      : metaAlphaValue / 100;

    sprite.anchor.set(0.5);
    sprite.position.set(
      this.canvasEngine.canvasWidth / 2,
      this.canvasEngine.canvasHeight / 2
    );
    sprite.scale.set(scale, scale);
    sprite.alpha = 1;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.blendMode = layerState?.object?.blendMode ?? 'normal';
    sprite.__toolType = 'mask';
    sprite.__maskMeta = {
      url,
      origin,
      alphaValue: Math.round(maskOpacity * 100),
      zoomValue,
      applyDeform: maskMeta.applyDeform !== false,
    };

    const hasStoredObjectState = [
      'x',
      'y',
      'scaleX',
      'scaleY',
      'rotation',
      'alpha',
      'skewX',
      'skewY',
    ].some((key) => objectState?.[key] !== undefined);

    if (hasStoredObjectState) {
      if (Number.isFinite(Number(objectState.x))) {
        sprite.x = Number(objectState.x);
      }

      if (Number.isFinite(Number(objectState.y))) {
        sprite.y = Number(objectState.y);
      }

      if (Number.isFinite(Number(objectState.scaleX))) {
        sprite.scale.x = Number(objectState.scaleX);
      }

      if (Number.isFinite(Number(objectState.scaleY))) {
        sprite.scale.y = Number(objectState.scaleY);
      }

      if (Number.isFinite(Number(objectState.rotation))) {
        sprite.rotation = Number(objectState.rotation);
      }

      if (Number.isFinite(Number(objectState.skewX))) {
        sprite.skew.x = Number(objectState.skewX);
      }

      if (Number.isFinite(Number(objectState.skewY))) {
        sprite.skew.y = Number(objectState.skewY);
      }
    } else if (maskMeta.applyDeform !== false) {
      sprite.rotation = (Math.random() * 4 - 2) * (Math.PI / 180);
      sprite.skew.set(
        Math.random() / 5 - 0.1,
        Math.random() / 5 - 0.1
      );
    }

    if (Array.isArray(objectState?.effects)) {
      sprite.__maskEffectState = JSON.parse(JSON.stringify(objectState.effects));
    }

    const layerId = this.layerManager.addLayer(layerState?.name ?? `Mask ${origin}`, 'mask');
    const layer = this.layerManager.getLayer(layerId);
    layer.container.addChild(sprite);
    layer.visible = layerState?.visible !== false;
    layer.locked = layerState?.locked === true;
    layer.container.visible = layer.visible;
    this.layerManager.setLayerOpacity(layerId, maskOpacity);
    this.layerManager.setActiveLayer(layerId);
    this.setCurrentMask(sprite, layer, zoomValue);

    return {
      sprite,
      layer,
      zoomValue,
      sourceUrl,
    };
  }

  async restoreMaskLayer(layerState, maskEffects = null) {
    const { sprite, layer } = await this.createMaskLayer(layerState);

    if (maskEffects && sprite.__maskEffectState?.length) {
      const stack = maskEffects.getEffectStack(sprite);
      stack.restore(sprite.__maskEffectState);
      maskEffects.applyEffects(sprite);
    }

    return layer;
  }

  clearCurrentMask() {
    if (!this.currentMaskLayer) {
      return;
    }

    const layerId = this.currentMaskLayer.id;
    this.layerManager.removeLayer(layerId);
    this.clearCurrentMaskReference(layerId);
  }

  getCurrentMask() {
    return this.currentMask;
  }

  getCurrentMaskLayer() {
    return this.currentMaskLayer;
  }

  setCurrentMask(sprite, layer, zoomValue = null) {
    this.currentMask = sprite ?? null;
    this.currentMaskLayer = layer ?? null;

    if (zoomValue !== null) {
      this.currentZoomValue = zoomValue;
    } else if (sprite?.__maskMeta?.zoomValue !== undefined) {
      this.currentZoomValue = Number(sprite.__maskMeta.zoomValue);
    }
  }

  clearCurrentMaskReference(layerId = null) {
    if (layerId && this.currentMaskLayer?.id !== layerId) {
      return false;
    }

    this.currentMask = null;
    this.currentMaskLayer = null;
    return true;
  }

  resolveZoomValue(sprite, zoomOverride) {
    let zoomValue = this.currentZoomValue;

    if (this.requiresResize(this.canvasEngine.canvasWidth, sprite.texture.width)) {
      zoomValue = 70;
    }

    if (this.requiresResize(this.canvasEngine.canvasHeight, sprite.texture.height)) {
      zoomValue = 70;
    }

    if (
      this.requiresMinimize(this.canvasEngine.canvasWidth, sprite.texture.width) ||
      this.requiresMinimize(this.canvasEngine.canvasHeight, sprite.texture.height)
    ) {
      zoomValue = 40;
    }

    if (zoomOverride !== null) {
      zoomValue = zoomOverride;
    }

    return zoomValue;
  }

  requiresResize(imageDimension, maskDimension) {
    return 1.3 * imageDimension > maskDimension;
  }

  requiresMinimize(imageDimension, maskDimension) {
    return 4 * imageDimension < maskDimension;
  }
}
