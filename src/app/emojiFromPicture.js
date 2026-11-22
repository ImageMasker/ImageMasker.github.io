// "Emojis from the picture": runs the small image model (integrations/EmojiDetector.js) on the
// picture without its masks and makes an emoji mask of what it sees. Optional, and only loaded
// when used; progress is announced on the bus as 'emoji-status' like background removal.

import { emojiLayerName, updateLayer } from '../core/model.js';
import { EmojiDetector } from '../integrations/EmojiDetector.js';
import { unmaskedDoc } from './strengthMeter.js';

const MODEL_SIZE = 336;

export class EmojiTools {
  constructor(app) {
    this.app = app;
    this.detector = new EmojiDetector();
    this.status = { busy: false, label: '' };
  }

  setStatus(busy, label = '') {
    this.status = { busy, label };
    this.app.bus.emit('emoji-status', this.status);
  }

  /** The picture without masks or effects, small: that is all the model needs. */
  pictureCanvas() {
    const doc = this.app.store.doc;
    const scale = Math.min(1, MODEL_SIZE / Math.min(doc.width, doc.height));

    return this.app.stage.renderToCanvas(unmaskedDoc(doc), { scale });
  }

  async suggest() {
    const { emojis, ranked } = await this.detector.pick(this.pictureCanvas(), (label) => this.setStatus(true, label));

    return { emojis, ranked };
  }

  async run(apply) {
    const app = this.app;

    if (this.status.busy || !app.requireImage('Load an image first.')) {
      return;
    }

    this.setStatus(true, 'Loading the picture model');

    try {
      const { emojis, ranked } = await this.suggest();

      apply(emojis);
      app.notify(
        `Emojis from the picture: ${emojis.join(' ')} (it saw ${ranked[0].name}). They can hint at the answer, so check before posting.`,
        'success',
        5200
      );
    } catch (error) {
      console.error(error);
      app.notify(`The picture model could not run. ${error.message}`, 'error', 5200);
    } finally {
      this.setStatus(false);
    }
  }

  /** Adds a new emoji mask made of what the picture shows. */
  addFromPicture(options = {}) {
    return this.run((emojis) => this.app.addEmojiMask(emojis, options));
  }

  /** Swaps the emojis of an existing emoji mask for what the picture shows. */
  applyToLayer(layerId) {
    return this.run((emojis) =>
      this.app.store.apply('Emojis from the picture', (doc) =>
        updateLayer(doc, layerId, (layer) => ({ emojis, ...(/^Emoji /.test(layer.name) ? { name: emojiLayerName(emojis) } : {}) }))
      )
    );
  }
}
