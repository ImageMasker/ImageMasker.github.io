import { el } from '../utils/dom.js';

export class SavedRoundsPanel {
  constructor() {
    this.refs = {};
    this.element = this.render();
  }

  render() {
    this.refs.savedRoundsButton = el('button', {
      id: 'displayRounds',
      type: 'button',
      textContent: 'Saved rounds',
      'aria-expanded': 'false',
    });
    this.refs.emptyState = el('div', {
      className: 'saved-rounds-empty-state hidden',
      textContent: 'No saved rounds yet. Save one from the editor or from an external image URL.',
    });
    this.refs.left = el('button', {
      id: 'left',
      type: 'button',
      textContent: '◀',
      'aria-label': 'Previous saved round',
    });
    this.refs.displayedImage = el('img', {
      id: 'displayedImage',
      alt: 'Saved round',
    });
    this.refs.displayedImagelink = el('a', { id: 'displayedImagelink', target: '_blank' }, [
      this.refs.displayedImage,
    ]);
    this.refs.right = el('button', {
      id: 'right',
      type: 'button',
      textContent: '▶',
      'aria-label': 'Next saved round',
    });
    this.refs.displayedTitle = el('input', {
      id: 'displayedTitle',
      type: 'text',
      placeholder: 'Round title',
      maxlength: '285',
      'aria-label': 'Saved round title',
    });
    this.refs.displayedAnswer = el('input', {
      id: 'displayedAnswer',
      type: 'text',
      placeholder: 'Round answer',
      'aria-label': 'Saved round answer',
    });
    this.refs.PostReddit2 = el('button', {
      id: 'PostReddit2',
      type: 'button',
      className: 'app-button',
      textContent: 'Submit to /r/PictureGame',
    });
    this.refs.UpdateInfo = el('button', {
      id: 'UpdateInfo',
      type: 'button',
      className: 'app-button',
      textContent: 'Update title and answer',
    });
    this.refs.delete = el('button', {
      id: 'delete',
      type: 'button',
      className: 'app-button',
      textContent: 'Delete round',
    });
    this.refs.export = el('button', {
      id: 'export',
      type: 'button',
      className: 'app-button',
      textContent: 'Copy YML',
    });
    this.refs.savedRounds = el('div', { id: 'savedRounds', className: 'hidden' }, [
      this.refs.left,
      this.refs.displayedImagelink,
      this.refs.right,
      this.refs.displayedTitle,
      this.refs.displayedAnswer,
      this.refs.PostReddit2,
      this.refs.UpdateInfo,
      this.refs.delete,
      this.refs.export,
    ]);
    this.refs.saveFromUrlButton = el('button', {
      id: 'saveFromURL',
      type: 'button',
      textContent: 'Save from URL',
      'aria-expanded': 'false',
    });
    this.refs.message = el('div', {
      className: 'panel-inline-message hidden',
      'aria-live': 'polite',
    });
    this.refs.confirmDeleteButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Delete it',
      id: 'confirmDeleteRound',
    });
    this.refs.cancelDeleteButton = el('button', {
      type: 'button',
      className: 'app-button',
      textContent: 'Cancel',
      id: 'cancelDeleteRound',
    });
    this.refs.confirmDelete = el('div', { className: 'delete-confirm hidden' }, [
      el('span', { textContent: 'Delete this saved round?' }),
      this.refs.confirmDeleteButton,
      this.refs.cancelDeleteButton,
    ]);
    this.refs.saveExternal = el('button', {
      id: 'saveExternal',
      type: 'button',
      className: 'app-button',
      textContent: 'Save round',
    });
    this.refs.saveFromURLURL = el('input', {
      id: 'saveFromURLURL',
      type: 'text',
      placeholder: 'Image URL',
      'aria-label': 'Image URL for saved round',
    });
    this.refs.saveFromURLTitle = el('input', {
      id: 'saveFromURLTitle',
      type: 'text',
      placeholder: 'Round title',
      maxlength: '285',
      'aria-label': 'Saved round title from URL',
    });
    this.refs.saveFromURLAnswer = el('input', {
      id: 'saveFromURLAnswer',
      type: 'text',
      placeholder: 'Round answer',
      'aria-label': 'Saved round answer from URL',
    });
    this.refs.saveExternalUrl = el('div', { id: 'saveExternalURL', className: 'hidden' }, [
      this.refs.saveFromURLURL,
      this.refs.saveFromURLTitle,
      this.refs.saveFromURLAnswer,
      this.refs.saveExternal,
      this.refs.message,
    ]);

    this.refs.root = el('section', { className: 'saved-rounds-shell' }, [
      this.refs.savedRoundsButton,
      this.refs.emptyState,
      this.refs.savedRounds,
      this.refs.confirmDelete,
      this.refs.saveFromUrlButton,
      this.refs.saveExternalUrl,
    ]);

    return this.refs.root;
  }

  setMessage(message = '', tone = 'info') {
    this.refs.message.textContent = message;
    this.refs.message.className = `panel-inline-message ${message ? `panel-inline-message--${tone}` : 'hidden'}`.trim();
  }

  setSavedRoundsExpanded(isExpanded) {
    this.refs.savedRoundsButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }

  setSaveFromUrlExpanded(isExpanded) {
    this.refs.saveFromUrlButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }
}
