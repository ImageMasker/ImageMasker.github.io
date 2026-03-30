import { el } from '../utils/dom.js';

export class CanvasArea {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.mobilePasteInput = el('input', {
      id: 'pastedURL',
      type: 'url',
      placeholder: 'Or paste the image URL here...',
      'aria-label': 'Paste image URL',
    });
    this.refs.mobilePaste = el('div', { id: 'mobilePaste' }, [
      this.refs.mobilePasteInput,
    ]);
    this.refs.mobileRisInput = el('input', {
      id: 'mobileRISURL',
      type: 'url',
      placeholder: 'Paste an URL here to check for RIS',
      'aria-label': 'Paste URL to check for RIS',
    });
    this.refs.mobileRis = el('div', { id: 'mobileRIS' }, [
      this.refs.mobileRisInput,
    ]);
    this.refs.fileInput = el('input', {
      id: 'imageUpload',
      type: 'file',
      accept: 'image/png,image/jpeg,image/gif',
      className: 'visually-hidden',
      'aria-label': 'Upload image file',
    });
    this.refs.pasteAsLayerInput = el('input', {
      id: 'pasteImagesAsLayer',
      type: 'checkbox',
      'aria-label': 'Paste images as new layers',
    });
    this.refs.pasteAsLayerInput.checked = true;
    this.refs.pasteAsLayerToggle = el('label', {
      className: 'paste-mode-toggle',
      for: 'pasteImagesAsLayer',
    }, [
      this.refs.pasteAsLayerInput,
      el('span', {
        className: 'paste-mode-toggle-label',
        textContent: 'Paste as new layer',
      }),
    ]);
    this.refs.pasteAsLayerHint = el('div', {
      className: 'paste-mode-toggle-hint',
      textContent: 'Turn off to replace the base image instead.',
    });
    this.refs.uploadButton = this.button('uploadbutton', 'Upload to Imgur', true);
    this.refs.accessTokenInput = el('input', {
      id: 'accessTokenInput',
      type: 'text',
      placeholder: 'Imgur access token',
      'aria-label': 'Imgur access token',
    });
    this.refs.accessTokenSubmit = this.button('accessTokenSubmit', 'Save token');
    this.refs.accessTokenDelete = this.button('accessTokenDelete', 'Delete token');
    this.refs.uploadedUrl = el('input', {
      id: 'uploadedUrl',
      type: 'text',
      className: 'hidden',
      'aria-label': 'Uploaded image URL',
    });
    this.refs.copyUrlButton = this.button('copyToClipboard', 'Copy', true);
    this.refs.checkRisButton = this.button('checkForRIS', 'Check RIS', true);
    this.refs.roundTitle = el('input', {
      id: 'roundTitle',
      type: 'text',
      placeholder: 'Round Title',
      maxlength: '285',
      className: 'hidden',
      'aria-label': 'Round title',
    });
    this.refs.roundAnswer = el('input', {
      id: 'roundAnswer',
      type: 'text',
      placeholder: 'Round Answer',
      className: 'hidden',
      'aria-label': 'Round answer',
    });
    this.refs.postRedditButton = this.button('PostReddit', 'Submit to /r/PictureGame', true);
    this.refs.subredditInput = el('input', {
      id: 'newSubInput',
      type: 'text',
      value: 'picturegame',
      placeholder: 'Subreddit',
      className: 'hidden',
      'aria-label': 'Subreddit',
    });
    this.refs.saveButton = this.button('Save', 'Save round', true);
    this.refs.copyImageButton = this.button('Copy', 'Copy to clipboard', true);
    this.refs.downloadButton = this.button('Download', 'Download image', true);
    this.refs.exportPresetSelect = el('select', {
      id: 'exportPreset',
      className: 'hidden',
      'aria-label': 'Export preset',
    }, [
      el('option', { value: 'original_png', textContent: 'Original PNG' }),
      el('option', { value: 'editor_png', textContent: 'Editor PNG' }),
      el('option', { value: 'web_jpeg', textContent: 'Web JPEG' }),
      el('option', { value: 'original_jpeg', textContent: 'Original JPEG' }),
    ]);
    this.refs.exportSizeSelect = el('select', {
      id: 'exportSize',
      className: 'hidden',
      'aria-label': 'Export size',
    }, [
      el('option', { value: 'original', textContent: 'Original size' }),
      el('option', { value: 'editor', textContent: 'Editor size' }),
    ]);
    this.refs.exportFormatSelect = el('select', {
      id: 'exportFormat',
      className: 'hidden',
      'aria-label': 'Export format',
    }, [
      el('option', { value: 'png', textContent: 'PNG' }),
      el('option', { value: 'jpeg', textContent: 'JPEG' }),
    ]);
    this.refs.exportQualityInput = el('input', {
      id: 'exportQuality',
      type: 'range',
      min: '40',
      max: '100',
      value: '92',
      className: 'sliders hidden',
      'aria-label': 'JPEG quality',
    });
    this.refs.exportQualityValue = el('span', {
      id: 'exportQualityValue',
      className: 'export-quality-value hidden',
      textContent: '92%',
    });
    this.refs.exportButton = this.button('Export', 'Copy YML', true);
    this.refs.zoomOutButton = this.button('zoomOut', '−', true, { 'aria-label': 'Zoom out' });
    this.refs.zoomLabel = el('span', { id: 'zoomLabel', className: 'zoom-label hidden', textContent: '100%' });
    this.refs.zoomInButton = this.button('zoomIn', '+', true, { 'aria-label': 'Zoom in' });
    this.refs.fitViewButton = this.button('fitView', 'Fit', true, { 'aria-label': 'Fit canvas to viewport' });
    this.refs.actualSizeButton = this.button('actualSize', '100%', true, { 'aria-label': 'Show canvas at actual size' });
    this.refs.dropOverlay = el('button', {
      type: 'button',
      className: 'drop-overlay',
      'aria-label': 'Drop an image, paste from clipboard, or click to upload',
    }, [
      el('div', { className: 'drop-overlay-icon', textContent: '📂' }),
      el('div', { className: 'drop-overlay-title', textContent: 'Drop an image here' }),
      el('div', { className: 'drop-overlay-subtitle', textContent: 'or paste from clipboard, or click to browse' }),
    ]);
    this.refs.workflowStatus = el('div', {
      className: 'workflow-status',
      textContent: 'Load an image to get started.',
    });
    this.refs.previewImage = el('div', { id: 'previewImage' }, [
      el('img', { id: 'imagePreview', alt: 'Preview' }),
    ]);
    this.refs.canvasHost = el('div', { id: 'canvasDiv' });
    this.refs.shareGroup = el('div', { className: 'action-group action-group--share' }, [
      el('div', { className: 'action-group-label', textContent: 'Share' }),
      el('div', { className: 'action-group-controls action-group-controls--stack' }, [
        el('div', { className: 'share-token-controls' }, [
          this.refs.accessTokenInput,
          this.refs.accessTokenSubmit,
          this.refs.accessTokenDelete,
        ]),
        el('div', { className: 'action-group-controls' }, [
          this.refs.uploadButton,
          this.refs.uploadedUrl,
          this.refs.copyUrlButton,
          this.refs.checkRisButton,
          this.refs.roundTitle,
          this.refs.roundAnswer,
          this.refs.postRedditButton,
          this.refs.subredditInput,
          this.refs.saveButton,
        ]),
      ]),
    ]);
    this.refs.importGroup = el('div', { className: 'action-group action-group--import' }, [
      el('div', { className: 'action-group-label', textContent: 'Paste' }),
      el('div', { className: 'action-group-controls action-group-controls--stack' }, [
        this.refs.pasteAsLayerToggle,
        this.refs.pasteAsLayerHint,
      ]),
    ]);
    this.refs.exportGroup = el('div', { className: 'action-group action-group--export' }, [
      el('div', { className: 'action-group-label', textContent: 'Export' }),
      el('div', { className: 'action-group-controls' }, [
        this.refs.copyImageButton,
        this.refs.downloadButton,
        this.refs.exportPresetSelect,
        this.refs.exportSizeSelect,
        this.refs.exportFormatSelect,
        this.refs.exportQualityInput,
        this.refs.exportQualityValue,
        this.refs.exportButton,
      ]),
    ]);
    this.refs.viewGroup = el('div', { className: 'action-group action-group--view' }, [
      el('div', { className: 'action-group-label', textContent: 'View' }),
      el('div', { className: 'action-group-controls action-group-controls--view' }, [
        this.refs.zoomOutButton,
        this.refs.zoomLabel,
        this.refs.zoomInButton,
        this.refs.fitViewButton,
        this.refs.actualSizeButton,
      ]),
    ]);
    this.refs.actionBar = el('div', { className: 'action-bar hidden' }, [
      this.refs.importGroup,
      this.refs.shareGroup,
      this.refs.exportGroup,
      this.refs.viewGroup,
    ]);

    this.refs.root = el('div', { id: 'preview' }, [
      el('div', { className: 'canvas-stage' }, [
        this.refs.fileInput,
        this.refs.dropOverlay,
        this.refs.previewImage,
        this.refs.canvasHost,
      ]),
    ]);

    return this.refs.root;
  }

  button(id, textContent, hidden = false, extraAttrs = {}) {
    return el('button', {
      id,
      type: 'button',
      className: `app-button ${hidden ? 'hidden' : ''}`.trim(),
      textContent,
      'data-shortcut-label': textContent,
      ...extraAttrs,
    });
  }
}
