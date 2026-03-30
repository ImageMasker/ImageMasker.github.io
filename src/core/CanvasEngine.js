import { addProxyToUrl } from '../integrations/CorsProxy.js';
import { devAssert } from '../utils/dev.js';
import { loadImageElement } from '../utils/image.js';

const { Application, Container, Sprite, Texture } = PIXI;

export class CanvasEngine {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.app = null;
    this.backgroundSprite = null;
    this.sourceImageElement = null;
    this.viewportContainer = null;
    this.documentContainer = null;
    this.overlayContainer = null;
    this.layerContainer = null;
    this.viewportStateBeforeExport = null;
    this.documentPositionBeforeExport = null;
    this.sourceImageUrl = '';
    this.imgWidth = 0;
    this.imgHeight = 0;
    this.canvasWidth = 1;
    this.canvasHeight = 1;
    this.editorWidth = 1;
    this.editorHeight = 1;
    this.isPreparedForExport = false;
  }

  async init() {
    this.app = new Application();

    const initialSize = this.getContainerSize();

    await this.app.init({
      width: initialSize.width,
      height: initialSize.height,
      backgroundColor: 0x000000,
      antialias: false,
      autoDensity: false,
      resolution: 1,
      preserveDrawingBuffer: true,
    });

    this.canvasWidth = initialSize.width;
    this.canvasHeight = initialSize.height;
    this.editorWidth = initialSize.width;
    this.editorHeight = initialSize.height;

    this.app.canvas.id = 'canvas';
    this.container.appendChild(this.app.canvas);

    this.viewportContainer = new Container();
    this.documentContainer = new Container();
    this.overlayContainer = new Container();
    this.layerContainer = new Container();
    this.documentContainer.addChild(this.layerContainer);
    this.viewportContainer.addChild(this.documentContainer);
    this.app.stage.addChild(this.viewportContainer);
    this.app.stage.addChild(this.overlayContainer);
  }

  async loadBackgroundImage(source, isExternal = false, options = {}) {
    if (!this.app) {
      throw new Error('CanvasEngine must be initialized before loading images.');
    }

    const resolvedSource = isExternal ? addProxyToUrl(source) : source;
    const image = await loadImageElement(resolvedSource, {
      crossOrigin: isExternal ? 'anonymous' : null,
    });
    const texture = Texture.from(image);
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;

    if (!imageWidth || !imageHeight) {
      throw new Error('Loaded image has invalid dimensions.');
    }

    this.sourceImageUrl = resolvedSource;
    this.sourceImageElement = image;
    this.imgWidth = imageWidth;
    this.imgHeight = imageHeight;

    const editorSize = this.getContainerSize();
    this.app.renderer.resize(editorSize.width, editorSize.height);
    this.editorWidth = editorSize.width;
    this.editorHeight = editorSize.height;
    const documentSize = this.resolveDocumentSize(imageWidth, imageHeight, options.documentSize, editorSize);
    this.canvasWidth = documentSize.width;
    this.canvasHeight = documentSize.height;
    this.app.stage.scale.set(1, 1);
    this.resetViewport(false);
    this.centerDocument();

    if (this.backgroundSprite) {
      this.documentContainer.removeChild(this.backgroundSprite);
      this.backgroundSprite.destroy();
    }

    this.backgroundSprite = new Sprite(texture);
    this.backgroundSprite.width = this.canvasWidth;
    this.backgroundSprite.height = this.canvasHeight;
    this.backgroundSprite.x = 0;
    this.backgroundSprite.y = 0;

    this.documentContainer.addChildAt(this.backgroundSprite, 0);

    if (!this.documentContainer.children.includes(this.layerContainer)) {
      this.documentContainer.addChild(this.layerContainer);
    } else {
      this.documentContainer.setChildIndex(this.layerContainer, this.documentContainer.children.length - 1);
    }

    this.eventBus.emit('canvas:resized', {
      width: this.canvasWidth,
      height: this.canvasHeight,
    });
    this.eventBus.emit('image:loaded', {
      width: imageWidth,
      height: imageHeight,
      editorWidth: this.canvasWidth,
      editorHeight: this.canvasHeight,
      source: source,
      resolvedSource,
      preserveScene: options.preserveScene === true,
    });
  }

  getContainerSize() {
    const width = Math.max(1, Math.round(this.container?.clientWidth || this.canvasWidth || 1));
    const height = Math.max(1, Math.round(this.container?.clientHeight || this.canvasHeight || 1));

    return {
      width,
      height,
    };
  }

  calculateDocumentSize(imageWidth, imageHeight, editorSize = this.getContainerSize()) {
    const widthRatio = 1000 / imageWidth;
    const heightRatio = 800 / imageHeight;
    const baseScale = Math.min(widthRatio, heightRatio, 1);
    const baseWidth = Math.max(1, Math.round(imageWidth * baseScale));
    const baseHeight = Math.max(1, Math.round(imageHeight * baseScale));
    const fitScale = Math.min(
      editorSize.width / baseWidth,
      editorSize.height / baseHeight,
      1
    );

    return {
      width: Math.max(1, Math.round(baseWidth * fitScale)),
      height: Math.max(1, Math.round(baseHeight * fitScale)),
    };
  }

  resolveDocumentSize(imageWidth, imageHeight, requestedSize = null, editorSize = this.getContainerSize()) {
    const requestedWidth = Number(requestedSize?.width);
    const requestedHeight = Number(requestedSize?.height);

    if (Number.isFinite(requestedWidth) && requestedWidth > 0 && Number.isFinite(requestedHeight) && requestedHeight > 0) {
      return {
        width: Math.max(1, Math.round(requestedWidth)),
        height: Math.max(1, Math.round(requestedHeight)),
      };
    }

    return this.calculateDocumentSize(imageWidth, imageHeight, editorSize);
  }

  centerDocument() {
    if (!this.documentContainer) {
      return;
    }

    this.documentContainer.position.set(
      (this.editorWidth - this.canvasWidth) / 2,
      (this.editorHeight - this.canvasHeight) / 2
    );
  }

  documentToGlobalPoint(x, y) {
    if (!this.documentContainer) {
      return { x, y };
    }

    const point = this.documentContainer.toGlobal({ x, y });
    return {
      x: point.x,
      y: point.y,
    };
  }

  prepareForExport(size = 'original') {
    if (!this.app || !this.imgWidth || !this.imgHeight) {
      return;
    }

    if (this.isPreparedForExport) {
      devAssert(false, 'prepareForExport was called while export mode was already active.', {
        imgWidth: this.imgWidth,
        imgHeight: this.imgHeight,
      });
      return;
    }

    this.editorWidth = Math.max(1, Math.round(this.app.renderer.width));
    this.editorHeight = Math.max(1, Math.round(this.app.renderer.height));
    this.viewportStateBeforeExport = this.getViewportState();
    this.documentPositionBeforeExport = {
      x: this.documentContainer?.x ?? 0,
      y: this.documentContainer?.y ?? 0,
    };
    this.resetViewport(false);
    this.overlayContainer.visible = false;

    const exportWidth = size === 'original' ? this.imgWidth : this.canvasWidth;
    const exportHeight = size === 'original' ? this.imgHeight : this.canvasHeight;

    this.app.renderer.resize(exportWidth, exportHeight);
    this.documentContainer?.position.set(0, 0);
    this.app.stage.scale.set(
      exportWidth / this.canvasWidth,
      exportHeight / this.canvasHeight
    );

    this.isPreparedForExport = true;
    this.eventBus.emit('canvas:resized', {
      width: exportWidth,
      height: exportHeight,
      mode: 'export',
    });
    this.eventBus.emit('export:start', {
      width: exportWidth,
      height: exportHeight,
    });
  }

  restoreFromExport() {
    if (!this.app) {
      return;
    }

    if (!this.isPreparedForExport) {
      devAssert(false, 'restoreFromExport was called without an active export session.');
      return;
    }

    this.app.renderer.resize(this.editorWidth, this.editorHeight);
    this.app.stage.scale.set(1, 1);
    this.documentContainer?.position.set(
      this.documentPositionBeforeExport?.x ?? 0,
      this.documentPositionBeforeExport?.y ?? 0
    );
    if (this.viewportStateBeforeExport) {
      this.setViewportTransform(this.viewportStateBeforeExport, false);
    }
    this.overlayContainer.visible = true;

    this.isPreparedForExport = false;
    this.eventBus.emit('canvas:resized', {
      width: this.canvasWidth,
      height: this.canvasHeight,
      mode: 'editor',
    });
    this.eventBus.emit('export:complete', {
      width: this.canvasWidth,
      height: this.canvasHeight,
    });
  }

  toDataURL(format = 'image/png', quality = 0.92) {
    this.app.renderer.render({
      container: this.app.stage,
    });

    return this.app.canvas.toDataURL(format, quality);
  }

  async toBlob(format = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
      this.app.renderer.render({
        container: this.app.stage,
      });

      this.app.canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob.'));
          return;
        }

        resolve(blob);
      }, format, quality);
    });
  }

  getViewportState() {
    return {
      scale: this.viewportContainer?.scale.x ?? 1,
      x: this.viewportContainer?.x ?? 0,
      y: this.viewportContainer?.y ?? 0,
    };
  }

  setViewportTransform({ scale = 1, x = 0, y = 0 } = {}, emit = true) {
    if (!this.viewportContainer) {
      return;
    }

    this.viewportContainer.scale.set(scale, scale);
    this.viewportContainer.position.set(x, y);

    if (emit) {
      this.eventBus.emit('viewport:changed', this.getViewportState());
    }
  }

  resetViewport(emit = true) {
    this.setViewportTransform({
      scale: 1,
      x: 0,
      y: 0,
    }, emit);
  }

  getActualSizeScale() {
    if (!this.imgWidth || !this.canvasWidth) {
      return 1;
    }

    return this.imgWidth / this.canvasWidth;
  }

  globalToDocumentPoint(x, y) {
    if (!this.documentContainer) {
      return { x, y };
    }

    const point = this.documentContainer.toLocal({ x, y });
    return {
      x: point.x,
      y: point.y,
    };
  }

  clientToGlobalPoint(clientX, clientY) {
    if (!this.app?.canvas) {
      return { x: clientX, y: clientY };
    }

    const rect = this.app.canvas.getBoundingClientRect();

    // Use the DOM rect as the source of truth for pointer mapping.
    // Pixi's internal event mapper can drift when the canvas is laid out by CSS.
    if (rect.width > 0 && rect.height > 0) {
      const viewWidth = this.app.canvas.width || this.app.renderer.width;
      const viewHeight = this.app.canvas.height || this.app.renderer.height;
      const scaleX = viewWidth / rect.width;
      const scaleY = viewHeight / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    const mappedPoint = { x: 0, y: 0 };

    if (this.app.renderer?.events?.mapPositionToPoint) {
      this.app.renderer.events.mapPositionToPoint(mappedPoint, clientX, clientY);
      return mappedPoint;
    }

    return {
      x: clientX,
      y: clientY,
    };
  }
}
