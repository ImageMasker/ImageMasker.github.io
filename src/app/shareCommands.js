// Output commands mixed into App: export, copy, download, posting to Reddit and local rounds.

import { createDoc, imageLayer, usedEmojis } from '../core/model.js';
import { loadEmojiArt } from '../raster/emojiArt.js';
import { el } from '../utils/dom.js';

export class ShareCommands {
  exportScale(size) {
    return size === 'editor' ? Math.min(1, this.stage.fitZoom()) : 1;
  }

  async exportBlob({ format = 'png', size = 'original', quality = 0.92, scale = 1 } = {}) {
    this.textEditor.close();
    // Emoji artwork still on its way would otherwise be drawn with the system font.
    await loadEmojiArt(usedEmojis(this.store.doc));

    let canvas = this.stage.renderToCanvas(this.store.doc, { scale: Math.min(scale, this.exportScale(size)) });

    if (format === 'jpeg') {
      const flat = document.createElement('canvas');
      const context = flat.getContext('2d');

      flat.width = canvas.width;
      flat.height = canvas.height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, flat.width, flat.height);
      context.drawImage(canvas, 0, 0);
      canvas = flat;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', quality));

    if (!blob) {
      throw new Error('The image could not be encoded.');
    }

    return blob;
  }

  async copyImage() {
    if (!this.requireImage('Load an image before copying.')) {
      return;
    }

    const issues = [];

    if (!window.isSecureContext) issues.push('this page is not in a secure context; use https:// or http://localhost');
    if (!window.ClipboardItem) issues.push('ClipboardItem is unavailable');
    if (!navigator.clipboard?.write) issues.push('navigator.clipboard.write is unavailable');

    if (issues.length) {
      this.notify(`Clipboard image copy isn't available because ${issues.join('; ')}.`, 'warning', 6200);
      return;
    }

    try {
      // PNG is the only image type every browser accepts on the clipboard.
      const blob = await this.exportBlob({ ...this.sharePanel.getExportOptions(), format: 'png' });

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.notify('Image copied to clipboard.', 'success');
    } catch (error) {
      this.notify(`Clipboard image copy failed. ${error?.name ?? ''} ${error?.message ?? ''}`.trim(), 'warning', 6200);
    }
  }

  async downloadImage() {
    if (!this.requireImage('Load an image before downloading.')) {
      return;
    }

    try {
      const options = this.sharePanel.getExportOptions();
      const url = URL.createObjectURL(await this.exportBlob(options));
      const now = new Date();
      const pad = (value) => String(value).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const link = el('a', { href: url, download: `round ${stamp}.${options.format === 'jpeg' ? 'jpg' : 'png'}` });

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this.notify('Download started.', 'success');
    } catch (error) {
      console.error(error);
      this.notify('Download failed.', 'error');
    }
  }

  /** True when the browser can hand picture files to other apps (the phone's share sheet). */
  canShareFiles() {
    try {
      return Boolean(navigator.canShare?.({ files: [new File([new Uint8Array(1)], 'round.png', { type: 'image/png' })] }));
    } catch {
      return false;
    }
  }

  /**
   * Hands the picture to the system share sheet, so on a phone it can go straight into the
   * Reddit app. `[Round N] title` goes along as the share text and is copied too, because not
   * every app picks the text up. Preparing a big picture can take longer than the tap that
   * allows sharing lasts; the browser then refuses, so the prepared file is kept and the next
   * tap shares it at once. `source` is a finished picture (a saved round) instead of the editor.
   * Returns true when shared, 'retry' when another tap is needed, false otherwise.
   */
  async shareImage(roundTitle = '', source = null) {
    if (!source && !this.requireImage('Load an image before sharing.')) {
      return false;
    }

    if (!this.canShareFiles()) {
      this.notify("This browser can't share pictures with other apps. Use Download or Copy image & post instead.", 'warning', 5200);
      return false;
    }

    const doc = source ?? this.store.doc;
    const options = source ? null : this.sharePanel.getExportOptions();
    const key = JSON.stringify([options, roundTitle]);
    let prepared = this.preparedShare?.doc === doc && this.preparedShare.key === key ? this.preparedShare : null;

    if (!prepared) {
      try {
        const [blob, number] = await Promise.all([source ?? this.exportBlob(options), this.redditPoster.nextRoundNumber().catch(() => null)]);
        const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';

        prepared = {
          doc,
          key,
          number,
          title: this.redditPoster.roundTitle(number ?? '?', roundTitle.trim()).trim(),
          file: new File([blob], `round-${number ?? 'picture'}.${extension}`, { type: blob.type || 'image/png' }),
        };
        this.preparedShare = prepared;
      } catch (error) {
        console.error(error);
        this.notify('The picture could not be prepared for sharing.', 'error');
        return false;
      }
    }

    // Not awaited: share() has to start while the tap still counts.
    const copied = navigator.clipboard?.writeText?.(prepared.title).then(() => true, () => false) ?? Promise.resolve(false);

    try {
      await navigator.share({ files: [prepared.file], title: prepared.title, text: prepared.title });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return false;
      }

      if (error?.name === 'NotAllowedError') {
        this.notify('The picture is ready. Press Share again to send it.', 'info', 6200);
        return 'retry';
      }

      this.notify(`Sharing failed. ${error?.message ?? ''}`.trim(), 'warning', 5200);
      return false;
    }

    this.preparedShare = null;

    if (!prepared.number) {
      this.notify('Shared, but the current round number could not be read. Fix the [Round ?] in the title.', 'warning', 6200);
    } else {
      this.notify(`Shared. Title${(await copied) ? ' (also on your clipboard)' : ''}: ${prepared.title}`, 'success', 6200);
    }

    return true;
  }

  /**
   * Copies the picture and opens Reddit's image post form for the next round, title filled in,
   * so the round can be posted without an image host: paste (Ctrl+V) and submit.
   */
  async copyAndPost(roundTitle, subreddit = 'picturegame', source = null) {
    if (!source && !this.requireImage('Load an image before posting.')) {
      return null;
    }

    if (!window.isSecureContext || !window.ClipboardItem || !navigator.clipboard?.write) {
      this.notify("This browser can't copy images to the clipboard. Use Download and attach the file on Reddit instead.", 'warning', 6200);
      return null;
    }

    // Start both right away so the clipboard write still counts as part of the click.
    const picture = source ? this.toPng(source) : this.exportBlob({ ...this.sharePanel.getExportOptions(), format: 'png' });
    const round = this.redditPoster.nextRoundNumber().catch(() => null);

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture })]);
    } catch (error) {
      this.notify(`Clipboard image copy failed. ${error?.name ?? ''} ${error?.message ?? ''}`.trim(), 'warning', 6200);
      return null;
    }

    const number = await round;

    if (!number) {
      this.notify('Image copied, but the current round number could not be read. Check the title before posting.', 'warning', 6200);
    }

    const url = this.redditPoster.imagePostUrl(number ?? '?', roundTitle, subreddit);
    const opened = window.open(url);

    this.notify(
      opened ? 'Image copied. Press Ctrl+V in the Reddit tab to attach it.' : 'Image copied, but the Reddit tab was blocked. Use the link in the Share tab.',
      opened ? 'success' : 'warning',
      6200
    );
    return { url, opened: Boolean(opened) };
  }

  /** Browsers only accept PNG on the clipboard. */
  async toPng(blob) {
    if (blob.type === 'image/png') {
      return blob;
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  /** Saves the finished picture with its title and answer in this browser (no upload, no layers). */
  async saveLocalRound(title, answer) {
    const doc = this.store.doc;
    const scale = Math.min(1, 3840 / Math.max(doc.width, doc.height));
    const blob = await this.exportBlob({ format: 'jpeg', size: 'original', quality: 0.9, scale });

    return this.localRounds.add({ blob, title, answer, width: Math.round(doc.width * scale), height: Math.round(doc.height * scale) });
  }

  /** Opens a saved picture as a fresh document (undo brings the previous work back). */
  async openAsNewDocument(blob, name = 'Saved round') {
    try {
      const asset = await this.assets.fromBlob(blob, { name });
      const doc = createDoc(asset.width, asset.height);

      doc.layers.push(imageLayer(doc, asset, { name: 'Base image', base: true }));

      if (this.store.hasImage) {
        this.textEditor.close();
        this.store.apply('Open saved round', () => doc);
        this.store.select([]);
        this.afterImageChange();
      } else {
        this.replaceDocument(doc);
      }

      this.sharePanel.setUploaded('');
      return true;
    } catch (error) {
      console.error(error);
      this.notify('That picture could not be opened.', 'error');
      return false;
    }
  }

  copyYml({ roundTitle, roundAnswer, imageUrl }) {
    return this.copyText(
      `masker_round_${Date.now()}:\n  title: |\n    ${roundTitle}\n  url: ${imageUrl}\n  answer: ${roundAnswer}\n`,
      'YML copied to clipboard.'
    );
  }

  async copyText(text, success = 'Copied to clipboard.') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = el('textarea', { readonly: '', style: 'position:absolute;left:-9999px' });

      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    this.notify(success, 'success');
  }
}
