// Picks emojis that match what is in a picture, with a small image model running in the browser.
//
// The model is Apple's MobileCLIP S0 (Xenova/mobileclip_s0 on Hugging Face), loaded on first use
// through Transformers.js. Only its image half is downloaded (about 23 MB in fp16, cached by the browser
// afterwards): the text half was run once over the description of every emoji it can choose
// (masks/pictureEmojis.js) and its output is shipped in masks/emojiEmbeddings.json
// (dev/emoji-embeddings.html makes it). The picture never leaves the browser.
//
// The rules below were tuned on about 120 photos of animals, food, places, vehicles and objects:
// the first emoji was right for 88% of them either way, but the old rule (always three from one
// theme) added unrelated fillers, so only a third of all chosen emojis fitted; this one keeps
// three quarters.

import { PICTURE_VOCAB } from '../masks/pictureEmojis.js';

export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
export const EMOJI_MODEL = 'Xenova/mobileclip_s0';
const EMBEDDINGS_URL = new URL('../masks/emojiEmbeddings.json', import.meta.url);
// CLIP's logit scale: turns cosine similarities into a sharp distribution.
const LOGIT_SCALE = 100;
// Emojis the picture matches at least this well compared with the best one are taken (up to MOST).
const CLEAR_MATCH = 0.1;
const MOST = 5;
// Fewer than FEWEST: add relatives of what was taken (descriptions this close, like 🐴 and 🐎)
// that the picture still matches somewhat.
const FEWEST = 3;
const RELATIVE = 0.8;
const STILL_MATCHES = 0.003;

function decodeEmbeddings(json) {
  const bytes = Uint8Array.from(atob(json.data), (char) => char.charCodeAt(0));
  const values = new Int8Array(bytes.buffer);
  const { dims, scale } = json;

  const byEmoji = new Map(json.emojis.map((emoji, index) => [emoji, index]));

  // In list order, looked up by emoji, so reordering the lists needs no new file.
  return PICTURE_VOCAB.map((entry) => {
    const index = byEmoji.get(entry.emoji);

    if (index === undefined || json.names?.[index] !== entry.name) {
      throw new Error('The emoji list for the picture model is out of date.');
    }

    const vector = new Float32Array(dims);

    for (let d = 0; d < dims; d += 1) {
      vector[d] = values[index * dims + d] / scale;
    }

    return { emoji: entry.emoji, vector };
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

      if (embeddings.model !== EMOJI_MODEL) {
        throw new Error('The emoji list for the picture model is out of date.');
      }

      // Checked before the model download: throws when an emoji or description changed.
      const vocab = decodeEmbeddings(embeddings);

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

      return { library, processor, model, vocab };
    })();

    // A failed load can be retried.
    this.loading.catch(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** The picture's embedding, unit length. */
  async embed(canvas) {
    const { library, processor, model } = await this.load();
    const { image_embeds: embeds } = await model(await processor(await library.RawImage.fromCanvas(canvas)));
    const vector = Float32Array.from(embeds.data);
    const norm = Math.hypot(...vector) || 1;

    return vector.map((value) => value / norm);
  }

  /**
   * Scores every emoji against `canvas` and returns them most likely first: [{ emoji, name,
   * score, vector }] with scores that add up to 1. The model only sees a square, so it looks at
   * the middle of the picture (its own crop) and at the whole picture on a grey square, and the
   * two are averaged: then neither the subject at the side of a wide photo nor the middle is lost.
   */
  async rank(canvas, onProgress = () => {}) {
    const { vocab } = await this.load(onProgress);
    const side = Math.max(canvas.width, canvas.height);
    const whole = document.createElement('canvas');
    const context = whole.getContext('2d');

    onProgress('Looking at the picture');
    whole.width = whole.height = side;
    context.fillStyle = '#808080';
    context.fillRect(0, 0, side, side);
    context.drawImage(canvas, (side - canvas.width) / 2, (side - canvas.height) / 2);

    const [middle, all] = [await this.embed(canvas), await this.embed(whole)];
    const image = middle.map((value, d) => value + all[d]);
    const norm = Math.hypot(...image) || 1;
    const logits = vocab.map(({ vector }) => {
      let dot = 0;

      for (let d = 0; d < vector.length; d += 1) dot += vector[d] * image[d];
      return (dot / norm) * LOGIT_SCALE;
    });
    const top = Math.max(...logits);
    const exps = logits.map((logit) => Math.exp(logit - top));
    const total = exps.reduce((sum, value) => sum + value, 0);

    return vocab.map((entry, index) => ({ emoji: entry.emoji, name: PICTURE_VOCAB[index].name, vector: entry.vector, score: exps[index] / total }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 1-5 emojis for a mask: everything the picture clearly matches (a dog and a beach), then, while
   * there are fewer than three, the closest relatives of those (🐴 → 🐎, 🐄) as long as the
   * picture still looks a bit like them. Unrelated fillers are left out, so a picture of one clear
   * thing can get just one or two emojis.
   */
  async pick(canvas, onProgress) {
    const ranked = await this.rank(canvas, onProgress);
    const best = ranked[0].score;
    const picked = ranked.filter((entry, index) => index < MOST && (index === 0 || entry.score >= best * CLEAR_MATCH));
    const related = (a, b) => {
      let dot = 0;

      for (let d = 0; d < a.length; d += 1) dot += a[d] * b[d];
      return dot >= RELATIVE;
    };

    for (const entry of ranked) {
      if (picked.length >= FEWEST || entry.score < best * STILL_MATCHES) break;
      if (!picked.includes(entry) && picked.some((chosen) => related(chosen.vector, entry.vector))) picked.push(entry);
    }

    return { emojis: picked.map((entry) => entry.emoji), ranked };
  }
}
