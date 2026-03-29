import { EffectStack } from '../filters/EffectStack.js';

export class MaskEffects {
  constructor(maskManager) {
    this.maskManager = maskManager;
    this.effectHelpers = {
      ensureDisplacementSprite: (mask, effect) => this.ensureDisplacementSprite(mask, effect),
    };
  }

  updateOpacity(value, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return;
    }

    mask.alpha = Number(value) / 100;
    if (mask.__maskMeta) {
      mask.__maskMeta.alphaValue = Number(value);
    }
  }

  updateZoom(sliderValue, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return;
    }

    const scale = 0.25 * Math.exp(0.0277 * Number(sliderValue));
    mask.scale.set(scale, scale);
    if (mask === this.maskManager.getCurrentMask()) {
      this.maskManager.currentZoomValue = Number(sliderValue);
    }
    if (mask.__maskMeta) {
      mask.__maskMeta.zoomValue = Number(sliderValue);
    }
  }

  rotateMask(angleDegrees, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return;
    }

    mask.rotation = Number(angleDegrees) * (Math.PI / 180);
  }

  updateHue(rotationValue, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return;
    }

    const hueValue = Number(rotationValue);
    this.updateEffect('hue', {
      enabled: hueValue !== 0,
      value: hueValue,
    }, mask);
  }

  invert(targetMask = null) {
    const mask = this.resolveMask(targetMask);
    const effect = this.getCurrentEffect('invert', mask);
    this.setEffectEnabled('invert', !effect?.enabled, mask);
  }

  updateBlur(strength, targetMask = null) {
    const numericStrength = Number(strength);
    this.updateEffect('blur', {
      enabled: numericStrength > 0,
      strength: numericStrength,
    }, targetMask);
  }

  updateNoiseWarp(noisePercent, targetMask = null) {
    const noise = Number(noisePercent) / 100;
    this.updateEffect('noiseWarp', {
      enabled: noise > 0,
      noise,
    }, targetMask);
  }

  updateDisplacement(strength, targetMask = null) {
    const numericStrength = Number(strength);
    const mask = this.resolveMask(targetMask);
    const current = this.getCurrentEffect('displacement', mask);
    this.updateEffect('displacement', {
      enabled: numericStrength > 0,
      strength: numericStrength,
      seed: current?.seed ?? Math.random(),
    }, mask);
  }

  reseedDisplacement(targetMask = null) {
    const mask = this.resolveMask(targetMask);
    const current = this.getCurrentEffect('displacement', mask);

    this.updateEffect('displacement', {
      enabled: true,
      strength: current?.strength > 0 ? current.strength : 18,
      seed: Math.random(),
    }, mask);
  }

  setEffectEnabled(type, enabled, targetMask = null) {
    const mask = this.resolveMask(targetMask);
    const effect = this.getCurrentEffect(type, mask);

    if (!effect) {
      return;
    }

    this.updateEffect(type, {
      enabled,
    }, mask);
  }

  getCurrentEffect(type, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return null;
    }

    return this.getEffectStack(mask).getEffect(type);
  }

  updateEffect(type, partialState, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return null;
    }

    const effect = this.getEffectStack(mask).updateEffect(type, partialState);
    this.applyEffects(mask);
    return effect;
  }

  resolveMask(targetMask = null) {
    return targetMask ?? this.maskManager.getCurrentMask();
  }

  getEffectStack(mask) {
    if (!mask.__effectStack) {
      mask.__effectStack = new EffectStack(mask.__maskEffectState ?? null);
    }

    return mask.__effectStack;
  }

  applyEffects(mask) {
    const stack = this.getEffectStack(mask);
    const filters = stack.buildFilters({
      owner: mask,
      helpers: this.effectHelpers,
    });

    mask.__maskEffectState = stack.serialize();
    mask.filters = filters.length > 0 ? filters : null;
  }

  ensureDisplacementSprite(mask, effect) {
    const existing = mask.__displacementResource;

    if (existing?.seed === effect.seed && existing.sprite) {
      if (mask.addChild && existing.sprite.parent !== mask) {
        mask.addChild(existing.sprite);
      }

      return existing.sprite;
    }

    if (existing?.sprite) {
      existing.sprite.parent?.removeChild(existing.sprite);
      existing.sprite.destroy();
      existing.texture?.destroy(true);
      mask.__displacementResource = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    const imageData = context.createImageData(canvas.width, canvas.height);
    const random = this.createSeededRandom(effect.seed ?? 0.5);

    for (let index = 0; index < imageData.data.length; index += 4) {
      const value = Math.floor(random() * 255);
      imageData.data[index] = value;
      imageData.data[index + 1] = Math.floor(random() * 255);
      imageData.data[index + 2] = 255 - value;
      imageData.data[index + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
    const texture = PIXI.Texture.from(canvas);
    const sprite = new PIXI.Sprite(texture);
    sprite.renderable = false;
    sprite.alpha = 0;
    sprite.position.set(-canvas.width / 2, -canvas.height / 2);
    sprite.scale.set(1.6, 1.6);

    if (mask.addChild) {
      mask.addChild(sprite);
    }

    mask.__displacementResource = {
      seed: effect.seed,
      sprite,
      texture,
    };

    return sprite;
  }

  createSeededRandom(seed) {
    let value = Math.floor((seed ?? 0.5) * 2147483647) || 1;

    return () => {
      value = (value * 48271) % 2147483647;
      return value / 2147483647;
    };
  }

  snapshotCurrentMask(targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask) {
      return null;
    }

    const effectStack = this.getEffectStack(mask);
    const effects = effectStack.serialize();
    const hueEffect = effects.find((effect) => effect.type === 'hue');
    const invertEffect = effects.find((effect) => effect.type === 'invert');

    return {
      alpha: mask.alpha,
      scaleX: mask.scale.x,
      scaleY: mask.scale.y,
      rotation: mask.rotation,
      zoomValue: Number(mask.__maskMeta?.zoomValue ?? this.maskManager.currentZoomValue ?? 50),
      hueValue: hueEffect?.value ?? 0,
      invertEnabled: Boolean(invertEffect?.enabled),
      effects,
    };
  }

  restoreCurrentMask(snapshot, targetMask = null) {
    const mask = this.resolveMask(targetMask);

    if (!mask || !snapshot) {
      return;
    }

    mask.alpha = snapshot.alpha;
    mask.scale.set(snapshot.scaleX, snapshot.scaleY);
    mask.rotation = snapshot.rotation;
    if (mask === this.maskManager.getCurrentMask()) {
      this.maskManager.currentZoomValue = snapshot.zoomValue;
    }
    if (mask.__maskMeta) {
      mask.__maskMeta.alphaValue = Math.round(snapshot.alpha * 100);
      mask.__maskMeta.zoomValue = snapshot.zoomValue;
    }
    const effects = snapshot.effects ?? this.buildLegacyEffects(snapshot);
    const stack = this.getEffectStack(mask);

    stack.restore(effects);
    this.applyEffects(mask);
  }

  buildLegacyEffects(snapshot) {
    return [
      {
        type: 'hue',
        enabled: snapshot.hueValue !== 0,
        value: snapshot.hueValue ?? 0,
      },
      {
        type: 'invert',
        enabled: snapshot.invertEnabled === true || (snapshot.invertCount ?? 0) > 0,
      },
      {
        type: 'blur',
        enabled: false,
        strength: 0,
      },
      {
        type: 'noiseWarp',
        enabled: false,
        noise: 0,
        seed: 0.5,
      },
      {
        type: 'displacement',
        enabled: false,
        strength: 0,
        seed: 0.5,
      },
    ];
  }
}
