// Settings → Masks: the mask key that links this browser's masks on media.picturega.me, and the
// moderators' review queue for community submissions.

import { el } from '../utils/dom.js';
import { button, message, row, select } from './kit.js';

const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

export class MaskSettingsPanel {
  constructor(app) {
    this.app = app;
    this.urls = [];
    this.status = 'pending';
    this.element = this.render();
  }

  get server() {
    return this.app.maskServer;
  }

  render() {
    this.keyField = el('input', { type: 'password', readonly: '', 'aria-label': 'Your mask key', autocomplete: 'off' });
    this.keyMessage = message();
    this.newKey = el('input', { type: 'text', placeholder: 'mk_… key from another device', 'aria-label': 'Mask key from another device', autocomplete: 'off' });

    this.tokenField = el('input', { type: 'password', placeholder: 'Moderator token', 'aria-label': 'Moderator token', autocomplete: 'off' });
    this.reviewMessage = message();
    this.reviewList = el('div', { className: 'mask-review-list' });
    this.statusSelect = select({
      label: 'Show',
      options: [
        { value: 'pending', label: 'Waiting for review' },
        { value: 'approved', label: 'In the community list' },
        { value: 'rejected', label: 'Rejected' },
      ],
      value: this.status,
      onChange: (value) => {
        this.status = value;
        void this.loadQueue();
      },
    });
    this.review = el('div', { className: 'stack hidden' }, [
      this.statusSelect.element,
      row([button('Refresh', { iconName: 'reset', onClick: () => this.loadQueue() })]),
      this.reviewMessage.element,
      this.reviewList,
    ]);

    return el('div', { className: 'stack' }, [
      el('section', { className: 'settings-section' }, [
        el('h2', { className: 'settings-section-title', textContent: 'Your mask key' }),
        el('p', {
          className: 'panel-intro-copy',
          textContent: `Masks you keep on ${this.server.host} belong to this key; there is no account. Paste it on another device to see the same masks there. Keep it private: anyone with it can see and delete your masks.`,
        }),
        el('div', { className: 'input-row' }, [
          this.keyField,
          button('Show', { onClick: (event) => this.toggleKey(event.currentTarget) }),
          button('Copy', { iconName: 'clipboard', onClick: () => this.app.copyText(this.server.key(), 'Mask key copied.') }),
        ]),
        el('div', { className: 'input-row' }, [this.newKey, button('Use this key', { onClick: () => this.useKey() })]),
        this.keyMessage.element,
      ]),
      el('section', { className: 'settings-section' }, [
        el('h2', { className: 'settings-section-title', textContent: 'Community mask moderation' }),
        el('p', { className: 'panel-intro-copy', textContent: 'For moderators: submitted masks only appear in the community list after you approve them here.' }),
        el('div', { className: 'input-row' }, [this.tokenField, button('Save', { onClick: () => this.saveToken() })]),
        this.review,
      ]),
    ]);
  }

  /** Called when the Masks tab is opened. */
  shown() {
    this.keyField.value = this.server.hasKey() ? this.server.key() : '(made when you first keep a mask online)';
    this.tokenField.value = this.server.modToken;
    this.review.classList.toggle('hidden', !this.server.modToken);

    if (this.server.modToken) {
      void this.loadQueue();
    }
  }

  toggleKey(control) {
    const showing = this.keyField.type === 'text';

    this.keyField.type = showing ? 'password' : 'text';
    control.querySelector('span:last-child').textContent = showing ? 'Show' : 'Hide';
  }

  async useKey() {
    try {
      this.server.setKey(this.newKey.value);
      this.newKey.value = '';
      this.shown();
      this.keyMessage.set('Key saved. Your masks from that key are listed in Masks → Custom (“Get … masks”).', 'success');
      this.app.library.custom.lastSync = 0;
      await this.app.library.custom.syncRemote();
    } catch (error) {
      this.keyMessage.set(error.message, 'error');
    }
  }

  saveToken() {
    this.server.modToken = this.tokenField.value;
    this.shown();

    if (!this.server.modToken) {
      this.reviewList.replaceChildren();
    }
  }

  async loadQueue() {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls = [];
    this.reviewMessage.set('Loading…', 'info');

    try {
      const masks = await this.server.reviewQueue(this.status);

      this.reviewMessage.set(masks.length ? '' : 'Nothing here.', 'info');
      this.reviewList.replaceChildren(...masks.map((mask) => this.reviewItem(mask)));
    } catch (error) {
      this.reviewList.replaceChildren();
      this.reviewMessage.set(error.status === 401 ? 'That moderator token was not accepted.' : error.message, 'error');
    }
  }

  reviewItem(mask) {
    const image = el('img', { alt: mask.name });
    const done = (text) => {
      item.remove();
      this.reviewMessage.set(this.reviewList.children.length ? text : `${text} Nothing else here.`, 'success');
      void this.app.library.custom.loadCommunity(true);
    };
    const decide = (decision) => async () => {
      try {
        await this.server.decide(mask.id, decision);
        done({ approve: `“${mask.name}” is now in the community list.`, reject: `“${mask.name}” was rejected.`, unpublish: `“${mask.name}” was taken off the list.` }[decision]);
      } catch (error) {
        this.reviewMessage.set(error.message, 'error');
      }
    };
    const remove = async () => {
      try {
        await this.server.removeAsModerator(mask.id);
        done(`“${mask.name}” was deleted.`);
      } catch (error) {
        this.reviewMessage.set(error.message, 'error');
      }
    };
    const actions = {
      pending: [button('Approve', { className: 'app-button--primary', onClick: decide('approve') }), button('Reject', { onClick: decide('reject') })],
      approved: [button('Take off the list', { onClick: decide('unpublish') })],
      rejected: [button('Approve after all', { onClick: decide('approve') })],
    }[this.status] ?? [];
    const item = el('div', { className: 'mask-review-item' }, [
      image,
      el('div', { className: 'mask-review-meta' }, [
        el('strong', { textContent: mask.name }),
        el('span', {
          className: 'panel-intro-copy',
          textContent: `${mask.author ? `by ${mask.author} · ` : ''}${mask.width} × ${mask.height} · ${formatSize(mask.size)} · key ${mask.owner}`,
        }),
        row([...actions, button('Delete', { iconName: 'trash', onClick: remove })]),
      ]),
    ]);

    // Pending masks are not public, so the preview is fetched with the moderator token.
    this.server.reviewFile(mask.id).then((blob) => {
      const url = URL.createObjectURL(blob);

      this.urls.push(url);
      image.src = url;
    }, () => {});
    return item;
  }
}
