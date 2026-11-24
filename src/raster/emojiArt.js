// Emoji artwork for emoji masks and stamps, so they look the same on every system.
//
// A `style` picks the set: 0 Twemoji, 1 the device's own emoji font, 2 Google's blob emojis
// (Blobmoji, the community-kept continuation of Android's old blobs). The SVGs come from jsDelivr,
// pinned, the first time an emoji is drawn and stay in memory afterwards. Drawing is synchronous:
// an emoji whose artwork has not arrived yet (or that the set lacks, or when offline) is drawn
// with the next set down (blobs → Twemoji → device font), and `onEmojiArt` listeners are told
// when more artwork is ready so the picture can be redrawn. Exports wait for it with `loadEmojiArt`.
//
// The PictureGame Discord server's own emojis are written `:name:` (masks/discordEmojis.js) and
// always drawn from images/discord-emojis/, whatever the style.

import { DISCORD_EMOJIS } from '../masks/discordEmojis.js';

export const EMOJI_STYLES = [
  { value: 0, label: 'Twemoji' },
  { value: 1, label: 'This device' },
  { value: 2, label: 'Google blobs' },
];
export const DEVICE_STYLE = 1;

const FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "Android Emoji", sans-serif';
// Pixel size the SVG is given; it is vector art, so it still draws sharp at any size.
const SVG_SIZE = 512;

const hex = (emoji, pad) => [...emoji].map((char) => char.codePointAt(0).toString(16).padStart(pad, '0'));

const SETS = {
  // Twemoji names drop FE0F unless the emoji is a ZWJ sequence.
  0: {
    url: (emoji) => `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/${twemojiCode(emoji)}.svg`,
    fallback: DEVICE_STYLE,
  },
  // Noto-style names: emoji_u + 4-digit code points joined by _, without any FE0F.
  2: {
    url: (emoji) => `https://cdn.jsdelivr.net/gh/C1710/blobmoji@v15.0/svg/emoji_u${hex(emoji.replace(/\ufe0f/g, ''), 4).join('_')}.svg`,
    fallback: 0,
  },
};

const CUSTOM = new Map(DISCORD_EMOJIS.map((emoji) => [`:${emoji.name}:`, new URL(`../../images/discord-emojis/${emoji.id}.avif`, import.meta.url).href]));

/** True for a PictureGame server emoji (`:name:`). */
export function isCustomEmoji(emoji) {
  return CUSTOM.has(emoji);
}

const entries = new Map();
const listeners = new Set();
let notifyQueued = false;
let version = 0;

export function twemojiCode(emoji) {
  return hex(emoji.includes('\u200d') ? emoji : emoji.replace(/\ufe0f/g, ''), 1).join('-');
}

/** A known style, or Twemoji. */
export function emojiStyle(style) {
  return style === DEVICE_STYLE || SETS[style] ? style : 0;
}

export function emojiArtUrl(emoji, style = 0) {
  return CUSTOM.get(emoji) ?? SETS[emojiStyle(style)]?.url(emoji) ?? '';
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

async function fetchImage(url) {
  if (!url.endsWith('.svg')) {
    const image = new Image();

    image.src = url;
    await image.decode();
    return image;
  }

  const response = await fetch(url, { mode: 'cors' });

  if (!response.ok) throw new Error(`error ${response.status}`);

  // The SVGs have only a viewBox (or a 100% size); a fixed size makes them drawable on a canvas in
  // every browser. Some have a pixel size and no viewBox: that size becomes the viewBox, or the
  // artwork would stay that small in the corner of the bigger box.
  const svg = (await response.text()).replace(/<svg\b[^>]*>/, (tag) => {
    const width = tag.match(/\swidth="([\d.]+)(?:px)?"/)?.[1];
    const height = tag.match(/\sheight="([\d.]+)(?:px)?"/)?.[1];
    const viewBox = /\sviewBox=/.test(tag) || !width || !height ? '' : ` viewBox="0 0 ${width} ${height}"`;

    return tag.replace(/\s(width|height)="[^"]*"/g, '').replace(/^<svg/, `<svg width="${SVG_SIZE}" height="${SVG_SIZE}"${viewBox}`);
  });
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = new Image();

  image.src = objectUrl;
  await image.decode();
  return image;
}

function entry(emoji, style) {
  const custom = CUSTOM.get(emoji);
  const key = custom ? `custom:${emoji}` : `${style}:${emoji}`;
  let item = entries.get(key);

  if (!item) {
    item = { image: null, failed: false, promise: null };
    item.promise = fetchImage(custom ?? SETS[style].url(emoji)).then(
      (image) => {
        item.image = image;
        version += 1;
        notify();
      },
      () => {
        item.failed = true;
        // The next set down is drawn instead; make sure it is loading.
        if (!custom && SETS[SETS[style].fallback]) entry(emoji, SETS[style].fallback);
        version += 1;
        notify();
      }
    );
    entries.set(key, item);
  }

  return item;
}

/**
 * The artwork to draw `emoji` with in `style`: an image, or null for the device font. Starts
 * loading what is missing; until it arrives the next set down is used.
 */
export function emojiImage(emoji, style = 0) {
  if (CUSTOM.has(emoji)) {
    return entry(emoji, style).image;
  }

  for (let current = emojiStyle(style); SETS[current]; current = SETS[current].fallback) {
    const item = entry(emoji, current);

    if (item.image) return item.image;
    if (!item.failed) {
      // Still loading: use whatever lower set is already there, without starting more loads.
      for (let lower = SETS[current].fallback; SETS[lower]; lower = SETS[lower].fallback) {
        const ready = entries.get(`${lower}:${emoji}`)?.image;

        if (ready) return ready;
      }
      return null;
    }
  }

  return null;
}

/** Changes when more of these emojis' artwork is ready (part of a raster's signature). */
export function emojiArtState(emojis, style = 0) {
  return emojis.map((emoji) => {
    const image = style === DEVICE_STYLE && !CUSTOM.has(emoji) ? null : emojiImage(emoji, style);

    return image ? String(image.src).slice(-6) : '0';
  }).join('');
}

/** Goes up every time some artwork arrives or fails. */
export function emojiArtVersion() {
  return version;
}

/** Waits until the artwork of every [emoji, style] pair has loaded or failed, at most `timeout` ms. */
export function loadEmojiArt(pairs, timeout = 8000) {
  const waitFor = async (emoji, style) => {
    if (CUSTOM.has(emoji)) {
      await entry(emoji, style).promise;
      return;
    }

    for (let current = emojiStyle(style); SETS[current]; current = SETS[current].fallback) {
      const item = entry(emoji, current);

      await item.promise;
      if (item.image) return;
    }
  };
  const all = Promise.all(pairs.map(([emoji, style]) => waitFor(emoji, style)));

  return Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeout))]);
}

export function onEmojiArt(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Draws `emoji` centred on the context's origin, about `size` pixels across, in `style`. */
export function drawEmoji(context, emoji, size, style = 0) {
  const custom = CUSTOM.has(emoji);
  const image = style === DEVICE_STYLE && !custom ? null : emojiImage(emoji, style);

  // A server emoji that has not loaded yet: nothing to draw (its name in the font would be odd).
  if (custom && !image) {
    return;
  }

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

/** The emoji for buttons and chips: an <img> of its artwork in `style`, falling back like drawing does. */
export function emojiGlyph(emoji, style = 0, className = 'emoji-glyph') {
  let current = emojiStyle(style);

  if (current === DEVICE_STYLE && !CUSTOM.has(emoji)) {
    return document.createTextNode(emoji);
  }

  const image = document.createElement('img');

  image.className = className;
  image.alt = emoji;
  image.draggable = false;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.src = emojiArtUrl(emoji, current);
  image.title = CUSTOM.has(emoji) ? emoji : '';
  image.addEventListener('error', () => {
    current = CUSTOM.has(emoji) ? null : SETS[current]?.fallback;

    if (SETS[current]) {
      image.src = emojiArtUrl(emoji, current);
    } else {
      image.replaceWith(document.createTextNode(emoji));
    }
  });
  return image;
}
