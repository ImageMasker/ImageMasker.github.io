import { COUNTRY_FLAGS, PRESET_MASKS } from '../masks/maskData.js';
import { el } from '../utils/dom.js';

export class MaskPanel {
  constructor(customMasks = []) {
    this.customMasks = customMasks;
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.countrySelect = el('select', { id: 'country', name: 'country' }, [
      el('option', { value: '', textContent: '' }),
      ...COUNTRY_FLAGS.map((flag) =>
        el('option', {
          value: flag.url,
          textContent: flag.name,
        })
      ),
    ]);
    this.refs.countrySelect.setAttribute('aria-label', 'Flag mask selector');

    this.refs.presetButtons = PRESET_MASKS.map((mask) =>
      el('button', {
        type: 'button',
        className: 'mask-thumb-button',
        'data-mask-id': String(mask.id),
        title: `Load preset mask ${mask.id}`,
        'aria-label': `Load preset mask ${mask.id}`,
      }, [
        el('img', {
          src: mask.thumb,
          alt: `Mask ${mask.id}`,
          width: '95',
          height: '95',
          className: 'mask-thumb-image',
        }),
      ])
    );

    this.refs.customMaskList = el('div', { className: 'mask-thumb-grid custom-mask-list' }, []);
    this.refs.customMaskInput = el('input', {
      id: 'customMaskURL',
      type: 'text',
      placeholder: 'Mask URL (Imgur)',
      'aria-label': 'Custom mask URL',
    });
    this.refs.message = el('div', {
      className: 'panel-inline-message hidden',
      'aria-live': 'polite',
    });
    this.refs.addMaskButton = el('button', {
      id: 'addMask',
      type: 'button',
      className: 'app-button',
      textContent: 'Submit mask',
    });
    this.refs.clearMasksButton = el('button', {
      id: 'clearMasks',
      type: 'button',
      className: 'app-button',
      textContent: 'Delete masks',
    });

    this.refs.root = el('div', { id: 'masksDiv' }, [
      el('fieldset', { id: 'masks', className: 'panel-fieldset' }, [
        el('legend', { textContent: 'Masks' }),
        el('div', { className: 'field-label', textContent: 'Flag mask selector:' }),
        this.refs.countrySelect,
        el('div', { className: 'mask-group' }, this.refs.presetButtons),
        this.refs.customMaskList,
        el('div', { className: 'mask-custom-row' }, [
          this.refs.customMaskInput,
          this.refs.addMaskButton,
          this.refs.clearMasksButton,
        ]),
        this.refs.message,
      ]),
    ]);

    this.renderCustomMasks(this.customMasks);
    return this.refs.root;
  }

  renderCustomMasks(urls) {
    this.refs.customMaskList.replaceChildren(
      ...urls.map((url) => this.createCustomMaskButton(url))
    );
  }

  appendCustomMask(url) {
    this.refs.customMaskList.appendChild(this.createCustomMaskButton(url));
  }

  createCustomMaskButton(url) {
    return el('button', {
      type: 'button',
      className: 'mask-thumb-button custom-mask-button',
      'data-custom-mask-url': url,
      title: 'Load custom mask',
      'aria-label': 'Load custom mask',
    }, [
      el('img', {
        src: url,
        alt: 'Custom mask',
        width: '95',
        height: '95',
        className: 'mask-thumb-image',
      }),
    ]);
  }

  setMessage(message = '', tone = 'info') {
    this.refs.message.textContent = message;
    this.refs.message.className = `panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }
}
