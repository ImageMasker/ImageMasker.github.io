import { PRESET_MASKS } from '../masks/maskData.js';
import { el } from '../utils/dom.js';

export class MaskPanel {
  constructor(customMasks = [], flagMasks = []) {
    this.customMasks = customMasks;
    this.flagMasks = flagMasks;
    this.refs = {};
    this.element = this.render();
  }

  render() {
    // Hidden select to keep compatibility with event handlers
    this.refs.countrySelect = el('select', { id: 'country', name: 'country' }, [
      el('option', { value: '', textContent: '' }),
      ...this.flagMasks.map((flag) =>
        el('option', {
          value: flag.id,
          textContent: flag.name,
        })
      ),
    ]);
    this.refs.countrySelect.setAttribute('aria-label', 'Flag mask selector');

    // Custom dropdown elements
    this.refs.dropdownTriggerText = el('span', { textContent: 'Select flag mask...' });
    this.refs.dropdownTriggerThumb = el('img', {
      className: 'custom-dropdown-trigger-thumb hidden',
      src: '',
      alt: '',
    });
    this.refs.dropdownTrigger = el('button', {
      id: 'countryDropdownTrigger',
      type: 'button',
      className: 'custom-dropdown-trigger',
      onClick: (e) => this.toggleDropdown(e),
    }, [
      el('div', { className: 'custom-dropdown-trigger-content' }, [
        this.refs.dropdownTriggerThumb,
        this.refs.dropdownTriggerText,
      ]),
      el('span', { className: 'custom-dropdown-arrow' }),
    ]);

    this.refs.dropdownSearch = el('input', {
      type: 'text',
      className: 'custom-dropdown-search',
      placeholder: 'Search flags...',
      onInput: (e) => this.filterFlags(e.target.value),
    });

    this.refs.dropdownGrid = el('div', { className: 'custom-dropdown-grid' });
    this.refs.noResults = el('div', {
      className: 'custom-dropdown-no-results',
      textContent: 'No flags found',
    });

    this.refs.dropdownPanel = el('div', { className: 'custom-dropdown-panel' }, [
      el('div', { className: 'custom-dropdown-search-wrapper' }, [
        this.refs.dropdownSearch,
      ]),
      this.refs.noResults,
      this.refs.dropdownGrid,
    ]);

    this.refs.dropdownContainer = el('div', { className: 'custom-dropdown' }, [
      this.refs.dropdownTrigger,
      this.refs.dropdownPanel,
    ]);

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
        this.refs.dropdownContainer,
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

  toggleDropdown(event) {
    event.stopPropagation();
    const isOpen = this.refs.dropdownContainer.classList.contains('is-open');
    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.refs.dropdownContainer.classList.add('is-open');
    this.refs.dropdownSearch.value = '';
    this.renderFlagGrid();

    // Auto-focus search input
    setTimeout(() => {
      this.refs.dropdownSearch.focus();
    }, 50);

    // Bind outside click listener
    this._outsideClickHandler = (e) => {
      if (!this.refs.dropdownContainer.contains(e.target)) {
        this.closeDropdown();
      }
    };

    // Bind Escape key listener
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeDropdown();
      }
    };

    document.addEventListener('click', this._outsideClickHandler);
    document.addEventListener('keydown', this._escHandler);
  }

  closeDropdown() {
    this.refs.dropdownContainer.classList.remove('is-open');

    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }

  filterFlags(value) {
    this.renderFlagGrid(value);
  }

  renderFlagGrid(filterText = '') {
    const query = filterText.toLowerCase().trim();
    const filtered = this.flagMasks.filter((flag) =>
      flag.name.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      this.refs.noResults.style.display = 'block';
      this.refs.dropdownGrid.style.display = 'none';
    } else {
      this.refs.noResults.style.display = 'none';
      this.refs.dropdownGrid.style.display = 'grid';
    }

    const selectedId = this.refs.countrySelect.value;

    const items = filtered.map((flag) => {
      const imgSrc = flag.motif?.src || flag.full?.src || '';

      const itemThumb = el('img', {
        className: 'custom-dropdown-item-thumb',
        src: imgSrc,
        alt: flag.name,
        loading: 'lazy',
      });

      const itemName = el('span', {
        className: 'custom-dropdown-item-name',
        textContent: flag.name,
        title: flag.name,
      });

      if (flag.name.length >= 10) {
        itemName.style.fontSize = '0.58rem';
      }
      if (flag.name.length >= 16) {
        itemName.style.fontSize = '0.52rem';
      }

      const isSelected = flag.id === selectedId;

      const itemButton = el('button', {
        type: 'button',
        className: `custom-dropdown-item${isSelected ? ' is-selected' : ''}`,
        title: flag.name,
        'aria-label': `Select flag mask ${flag.name}`,
        onClick: () => this.selectFlag(flag),
      }, [
        itemThumb,
        itemName,
      ]);

      return itemButton;
    });

    this.refs.dropdownGrid.replaceChildren(...items);
  }

  selectFlag(flag) {
    if (flag) {
      this.refs.countrySelect.value = flag.id;
      this.refs.dropdownTriggerText.textContent = flag.name;
      this.refs.dropdownTriggerThumb.src = flag.motif?.src || flag.full?.src || '';
      this.refs.dropdownTriggerThumb.classList.remove('hidden');
    } else {
      this.refs.countrySelect.value = '';
      this.refs.dropdownTriggerText.textContent = 'Select flag mask...';
      this.refs.dropdownTriggerThumb.src = '';
      this.refs.dropdownTriggerThumb.classList.add('hidden');
    }

    this.refs.countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    this.closeDropdown();
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
