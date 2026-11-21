export const EXPORT_PRESETS = {
  original_png: {
    id: 'original_png',
    label: 'Original PNG',
    format: 'png',
    size: 'original',
    quality: 0.92,
  },
  editor_png: {
    id: 'editor_png',
    label: 'Editor PNG',
    format: 'png',
    size: 'editor',
    quality: 0.92,
  },
  web_jpeg: {
    id: 'web_jpeg',
    label: 'Web JPEG',
    format: 'jpeg',
    size: 'editor',
    quality: 0.85,
  },
  original_jpeg: {
    id: 'original_jpeg',
    label: 'Original JPEG',
    format: 'jpeg',
    size: 'original',
    quality: 0.92,
  },
};

export class ExportManager {
  constructor(canvasEngine) {
    this.canvasEngine = canvasEngine;
  }

  getPreset(presetId) {
    return EXPORT_PRESETS[presetId] ?? EXPORT_PRESETS.original_png;
  }

  resolveOptions(overrides = {}) {
    const preset = this.getPreset(overrides.presetId);

    return {
      presetId: preset.id,
      format: overrides.format ?? preset.format,
      size: overrides.size ?? preset.size,
      quality: overrides.quality ?? preset.quality,
    };
  }

  getMimeType(format) {
    return format === 'jpeg' ? 'image/jpeg' : 'image/png';
  }

  getFileExtension(format) {
    return format === 'jpeg' ? 'jpg' : 'png';
  }

  async exportDataUrl(overrides = {}) {
    const options = this.resolveOptions(overrides);
    const mimeType = this.getMimeType(options.format);

    return this.withExportState(options.size, () =>
      this.canvasEngine.toDataURL(mimeType, options.quality)
    );
  }

  async exportBlob(overrides = {}) {
    const options = this.resolveOptions(overrides);
    const mimeType = this.getMimeType(options.format);

    return this.withExportState(options.size, () =>
      this.canvasEngine.toBlob(mimeType, options.quality)
    );
  }

  buildFilename(format, prefix = 'round') {
    const now = new Date();
    const dateStamp =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStamp =
      `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

    return `${prefix} ${dateStamp} ${timeStamp}.${this.getFileExtension(format)}`;
  }

  async withExportState(size, callback) {
    const shouldPrepare = size === 'original' || size === 'editor';

    if (shouldPrepare) {
      this.canvasEngine.prepareForExport(size);
    }

    try {
      return await callback();
    } finally {
      if (shouldPrepare) {
        this.canvasEngine.restoreFromExport();
      }
    }
  }
}
