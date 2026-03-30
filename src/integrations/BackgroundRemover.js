const BACKGROUND_REMOVAL_MODULE_URL = 'https://esm.sh/@imgly/background-removal@1.7.0?bundle';

export class BackgroundRemover {
  constructor() {
    this.modulePromise = null;
  }

  async removeBackground(imageSource, { onProgress = null } = {}) {
    const module = await this.loadModule();
    const removeBackground = module?.removeBackground;

    if (typeof removeBackground !== 'function') {
      throw new Error('The background removal library could not be loaded.');
    }

    try {
      return await removeBackground(imageSource, {
        device: 'cpu',
        output: {
          format: 'image/png',
          quality: 1,
        },
        ...(typeof onProgress === 'function'
          ? {
              progress: onProgress,
            }
          : {}),
      });
    } catch (error) {
      throw new Error(error?.message || 'Background removal failed.');
    }
  }

  loadModule() {
    if (!this.modulePromise) {
      this.modulePromise = import(BACKGROUND_REMOVAL_MODULE_URL);
    }

    return this.modulePromise;
  }
}
