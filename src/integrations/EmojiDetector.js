// Picks emojis that match what is in a picture, with a small image model running in the browser.
//
// The model is Apple's MobileCLIP S0 (Xenova/mobileclip_s0 on Hugging Face), loaded on first use
// through Transformers.js. Only its image half is downloaded (about 23 MB in fp16, cached by the browser
// afterwards): the text half was run once over every palette description in masks/emojiData.js
// and its output is shipped in masks/emojiEmbeddings.json (dev/emoji-embeddings.html makes it).
// The picture never leaves the browser.

import { EMOJI_VOCAB } from '../masks/emojiData.js';

export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
export const EMOJI_MODEL = 'Xenova/mobileclip_s0';
const EMBEDDINGS_URL = new URL('../masks/emojiEmbeddings.json', import.meta.url);
// CLIP's logit scale: turns cosine similarities into a sharp distribution.
const LOGIT_SCALE = 100;

function decodeEmbeddings(json) {
  const bytes = Uint8Array.from(atob(json.data), (char) => char.charCodeAt(0));
  const values = new Int8Array(bytes.buffer);
  const { dims, scale } = json;

  return json.emojis.map((emoji, index) => {
    const vector = new Float32Array(dims);

    for (let d = 0; d < dims; d += 1) {
      vector[d] = values[index * dims + d] / scale;
    }

    return { emoji, vector };
  });
}

export class EmojiDetector {
  constructor() {
    this.loading = null;
  }

  /** Loads the library, the image model and the precomputed emoji embeddings (once). */
  load(onProgress = () => {}) {
    this.loading ??= (async () => {
      onProgress('Loading the picture model');

      const [library, embeddings] = await Promise.all([
        import(TRANSFORMERS_URL),
        fetch(EMBEDDINGS_URL).then((response) => {
          if (!response.ok) throw new Error('The emoji list for the picture model is missing.');
          return response.json();
        }),
      ]);

      if (embeddings.model !== EMOJI_MODEL || embeddings.emojis.length !== EMOJI_VOCAB.length) {
        throw new Error('The emoji list for the picture model is out of date.');
      }

      library.env.allowLocalModels = false;

      const progress = (event) => {
        if (event.status === 'progress' && event.file?.endsWith('.onnx') && event.total) {
          onProgress(`Downloading the picture model (${Math.round((event.loaded / event.total) * 100)}%)`);
        }
      };
      const [processor, model] = await Promise.all([
        library.AutoProcessor.from_pretrained(EMOJI_MODEL),
        library.CLIPVisionModelWithProjection.from_pretrained(EMOJI_MODEL, { dtype: 'fp16', device: 'wasm', progress_callback: progress }),
      ]);

      return { library, processor, model, vocab: decodeEmbeddings(embeddings) };
    })();

    // A failed load can be retried.
    this.loading.catch(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /**
   * Scores every palette emoji against `canvas` and returns the best ones, most likely first:
   * [{ emoji, name, score }] with scores that add up to 1 over the whole palette.
   */
  async rank(canvas, onProgress = () => {}) {
    const { library, processor, model, vocab } = await this.load(onProgress);

    onProgress('Looking at the picture');

    const image = await library.RawImage.fromCanvas(canvas);
    const inputs = await processor(image);
    const { image_embeds: embeds } = await model(inputs);
    const raw = embeds.data;
    let norm = 0;

    for (const value of raw) norm += value * value;
    norm = Math.sqrt(norm) || 1;

    const logits = vocab.map(({ vector }) => {
      let dot = 0;

      for (let d = 0; d < vector.length; d += 1) dot += vector[d] * raw[d];
      return (dot / norm) * LOGIT_SCALE;
    });
    const top = Math.max(...logits);
    const exps = logits.map((logit) => Math.exp(logit - top));
    const total = exps.reduce((sum, value) => sum + value, 0);

    return EMOJI_VOCAB.map((entry, index) => ({ emoji: entry.emoji, name: entry.name, score: exps[index] / total }))
      .sort((a, b) => b.score - a.score);
  }

  /** 3-5 emojis for a mask: the three best matches plus whichever others are nearly as likely. */
  async pick(canvas, onProgress) {
    const ranked = await this.rank(canvas, onProgress);
    const best = ranked[0].score;
    const picked = ranked.filter((entry, index) => index < 5 && (index < 3 || entry.score >= best * 0.12));

    return { emojis: picked.map((entry) => entry.emoji), ranked };
  }
}
