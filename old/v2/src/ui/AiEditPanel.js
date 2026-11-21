import { el } from '../utils/dom.js';

const SERVICE_OPTIONS = [
  { value: 'aiStudio', label: 'AI Studio (Google)' },
  { value: 'nanoGpt', label: 'Nano-GPT' },
  { value: 'fal', label: 'fal.ai' },
  { value: 'comfyUi', label: 'Custom ComfyUI API' },
];

const SOURCE_OPTIONS = [
  { value: 'selected-layer', label: 'Selected layer' },
  { value: 'visible-layers', label: 'All visible layers' },
  { value: 'selection-bounds', label: 'Selection bounds' },
];

export class AiEditPanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.serviceSelect = el(
      'select',
      {
        id: 'aiEditService',
        'aria-label': 'AI editing service',
      },
      SERVICE_OPTIONS.map((service) =>
        el('option', {
          value: service.value,
          textContent: service.label,
        })
      )
    );

    this.refs.modelSelect = el('select', {
      id: 'aiEditModel',
      'aria-label': 'AI editing model',
    });

    this.refs.sourceSelect = el(
      'select',
      {
        id: 'aiEditSourceMode',
        'aria-label': 'AI edit source',
      },
      SOURCE_OPTIONS.map((source) =>
        el('option', {
          value: source.value,
          textContent: source.label,
        })
      )
    );

    this.refs.tokenLabel = el('div', {
      className: 'field-label',
      textContent: 'API key:',
    });

    this.refs.tokenInput = el('input', {
      id: 'aiEditToken',
      type: 'password',
      placeholder: 'Paste your API key',
      autocomplete: 'off',
      'aria-label': 'AI editing API key',
    });

    this.refs.customUrlLabel = el('div', {
      className: 'field-label',
      textContent: 'API URL:',
    });

    this.refs.customUrlInput = el('input', {
      id: 'aiEditCustomUrl',
      type: 'url',
      placeholder: 'https://127.0.0.1:8188',
      autocomplete: 'off',
      'aria-label': 'Custom ComfyUI API URL',
    });

    this.refs.serviceHint = el('div', {
      className: 'panel-intro-copy ai-edit-service-hint',
      textContent: 'Use a token for hosted services, or point at a ComfyUI API URL.',
    });

    this.refs.promptInput = el('textarea', {
      id: 'aiEditPrompt',
      rows: '5',
      placeholder: 'Describe the edit you want. Example: remove the watermark, brighten the scene, and replace the sky with sunset clouds.',
      'aria-label': 'AI edit prompt',
    });

    this.refs.refreshModelsButton = el('button', {
      id: 'aiEditRefreshModels',
      type: 'button',
      className: 'app-button',
      textContent: 'Refresh models',
    });

    this.refs.generateButton = el('button', {
      id: 'aiEditGenerate',
      type: 'button',
      className: 'app-button',
      textContent: 'Generate layer',
    });

    this.refs.progress = el('div', {
      className: 'ai-edit-progress hidden',
      'aria-live': 'polite',
    }, [
      el('span', { className: 'ai-edit-spinner', 'aria-hidden': 'true' }),
      el('span', {
        className: 'ai-edit-progress-label',
        textContent: 'Generating',
      }),
    ]);

    this.refs.message = el('div', {
      className: 'panel-inline-message hidden',
      'aria-live': 'polite',
    });

    this.refs.customUrlBlock = el('div', { className: 'tool-field-block ai-edit-url-block hidden' }, [
      this.refs.customUrlLabel,
      el('div', { className: 'field-controls' }, [this.refs.customUrlInput]),
    ]);

    this.refs.root = el('fieldset', { id: 'aiEditPanel', className: 'panel-fieldset' }, [
      el('legend', { textContent: 'AI Edit' }),
      this.field('Service:', [this.refs.serviceSelect]),
      this.field('Model:', [this.refs.modelSelect]),
      this.field('Source:', [this.refs.sourceSelect]),
      el('div', { className: 'tool-field-block ai-edit-token-block' }, [
        this.refs.tokenLabel,
        el('div', { className: 'field-controls' }, [this.refs.tokenInput]),
      ]),
      this.refs.customUrlBlock,
      this.refs.serviceHint,
      this.field('Edit prompt:', [this.refs.promptInput]),
      el('div', { className: 'button-row ai-edit-actions' }, [
        this.refs.refreshModelsButton,
        this.refs.generateButton,
      ]),
      this.refs.progress,
      this.refs.message,
    ]);

    return this.refs.root;
  }

  field(label, children) {
    return el('div', { className: 'tool-field-block' }, [
      el('div', { className: 'field-label', textContent: label }),
      el('div', { className: 'field-controls' }, children),
    ]);
  }

  setServiceMeta({
    tokenLabel = 'API key',
    tokenPlaceholder = 'Paste your API key',
    customUrlLabel = 'API URL',
    customUrlPlaceholder = 'https://127.0.0.1:8188',
    showCustomUrl = false,
    hint = '',
  } = {}) {
    this.refs.tokenLabel.textContent = `${tokenLabel}:`;
    this.refs.tokenInput.placeholder = tokenPlaceholder;
    this.refs.customUrlLabel.textContent = `${customUrlLabel}:`;
    this.refs.customUrlInput.placeholder = customUrlPlaceholder;
    this.refs.serviceHint.textContent = hint;
    this.refs.customUrlBlock.classList.toggle('hidden', !showCustomUrl);
  }

  setModels(models, selectedModel = '') {
    const items = Array.isArray(models) ? models : [];

    if (items.length === 0) {
      this.refs.modelSelect.replaceChildren(
        el('option', {
          value: '',
          textContent: 'No models available',
        })
      );
      this.refs.modelSelect.disabled = true;
      return;
    }

    this.refs.modelSelect.disabled = false;
    this.refs.modelSelect.replaceChildren(
      ...items.map((model) =>
        el('option', {
          value: model.id,
          textContent: model.label,
        })
      )
    );

    const nextModel = items.some((model) => model.id === selectedModel)
      ? selectedModel
      : items[0].id;
    this.refs.modelSelect.value = nextModel;
  }

  setBusy(isBusy, message = 'Generating') {
    this.refs.root.classList.toggle('is-busy', isBusy);
    this.refs.progress.classList.toggle('hidden', !isBusy);
    this.refs.refreshModelsButton.disabled = isBusy;
    this.refs.generateButton.disabled = isBusy;
    this.refs.serviceSelect.disabled = isBusy;
    this.refs.modelSelect.disabled = isBusy || this.refs.modelSelect.options.length === 0;
    this.refs.sourceSelect.disabled = isBusy;
    this.refs.tokenInput.disabled = isBusy;
    this.refs.customUrlInput.disabled = isBusy;
    this.refs.promptInput.disabled = isBusy;
    this.refs.progress.querySelector('.ai-edit-progress-label').textContent = message;
    this.refs.generateButton.textContent = isBusy ? 'Generating...' : 'Generate layer';
  }

  setMessage(message = '', tone = 'info') {
    this.refs.message.textContent = message;
    this.refs.message.className = `panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }
}
