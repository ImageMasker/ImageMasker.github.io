// Twemoji artwork for emoji masks and stamps, so they look the same on every system.
//
// The SVGs come from jsDelivr (jdecked/twemoji, pinned) the first time an emoji is drawn and stay in
// memory afterwards. Drawing is synchronous: an emoji that has not arrived yet (or that Twemoji
// lacks, or when offline) is drawn with the system emoji font instead, and `onTwemoji` listeners
// are told when more artwork is ready so the picture can be redrawn. Exports wait for it with
// `loadTwemoji`.

const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/';
const FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "Android Emoji", sans-serif';
// Pixel size the SVG is given; it is vector art, so it still draws sharp at any size.
const SVG_SIZE = 512;

const entries = new Map();
const listeners = new Set();
let notifyQueued = false;
let version = 0;

/** Twemoji's file name for an emoji: its code points in hex, without FE0F unless it is a ZWJ sequence. */
export function twemojiCode(emoji) {
  const text = emoji.includes('\u200d') ? emoji : emoji.replace(/\ufe0f/g, '');

  return [...text].map((char) => char.codePointAt(0).toString(16)).join('-');
}

export function twemojiUrl(emoji) {
  return `${BASE}${twemojiCode(emoji)}.svg`;
}

function notify() {
  if (notifyQueued) return;
  notifyQueued = true;
  // Several emojis usually arrive together; one redraw is enough.
  setTimeout(() => {
    notifyQueued = false;
    for (const listener of listeners) listener();
  }, 30);
}

async function fetchImage(emoji) {
  const response = await fetch(twemojiUrl(emoji), { mode: 'cors' });

  if (!response.ok) throw new Error(`error ${response.status}`);

  // Twemoji SVGs only have a viewBox; a fixed size makes them drawable on a canvas in every browser.
  const svg = (await response.text()).replace(/<svg\b/, `<svg width="${SVG_SIZE}" height="${SVG_SIZE}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = new Image();

  image.src = url;
  await image.decode();
  return image;
}

function entry(emoji) {
  let item = entries.get(emoji);

  if (!item) {
    item = { image: null, failed: false, promise: null };
    item.promise = fetchImage(emoji).then(
      (image) => {
        item.image = image;
        version += 1;
        notify();
      },
      () => {
        item.failed = true;
      }
    );
    entries.set(emoji, item);
  }

  return item;
}

/** The loaded artwork for `emoji`, or null (and starts loading it). */
export function twemojiImage(emoji) {
  return entry(emoji).image;
}

/** Changes when more of these emojis' artwork is ready (part of a raster's signature). */
export function twemojiState(emojis) {
  return emojis.map((emoji) => (entry(emoji).image ? '1' : '0')).join('');
}

/** Goes up every time some artwork arrives. */
export function twemojiVersion() {
  return version;
}

/** Waits until every emoji's artwork has loaded or failed, at most `timeout` ms. */
export function loadTwemoji(emojis, timeout = 8000) {
  const all = Promise.all([...new Set(emojis)].map((emoji) => entry(emoji).promise));

  return Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeout))]);
}

export function onTwemoji(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Draws `emoji` centred on the context's origin, about `size` pixels across: Twemoji artwork
 * when `twemoji` is set and it is ready, otherwise the system emoji font.
 */
export function drawEmoji(context, emoji, size, twemoji = true) {
  const image = twemoji ? twemojiImage(emoji) : null;

  if (image) {
    const side = size * 0.92;

    context.drawImage(image, -side / 2, -side / 2, side, side);
    return;
  }

  context.font = `${size}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(emoji, 0, size * 0.04);
}

/** An <img> of the emoji's Twemoji artwork for buttons and chips, falling back to the text. */
export function emojiGlyph(emoji, className = 'emoji-glyph') {
  const image = document.createElement('img');

  image.className = className;
  image.alt = emoji;
  image.draggable = false;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.src = twemojiUrl(emoji);
  image.addEventListener('error', () => image.replaceWith(document.createTextNode(emoji)), { once: true });
  return image;
}
