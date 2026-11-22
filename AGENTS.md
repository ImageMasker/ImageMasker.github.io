# ImageMasker – notes for coding agents

Static GitHub Pages site. Native ES modules, **no build step, no dependencies, no package.json**. Keep it that way.

## Run

```bash
python -m http.server 8000   # or: npx http-server . -p 8000 -c-1
```

Open `http://localhost:8000/`. `file://` does not work (ES modules). On Windows, `python -m http.server`
can stall under many parallel requests from an automated browser; `http-server` is more reliable there.

## Verify

There is no test runner or linter.

* `node --check <file>` catches syntax errors in a changed module.
* `dev/effect-sheet.html` compiles and renders every effect and pattern; shader errors are printed on
  the page and exposed as `window.__sheet.errors`. Check it after editing `src/gl/effects.js`,
  `src/gl/patterns.js` or `src/gl/glsl.js`.
* `dev/tests.html` runs the core logic tests (model, undo, geometry, collage cuts) in the browser;
  results are in `window.__tests`. Add a test there when you change `src/core` or `src/collage`.
* For behaviour, drive the real page in a browser (headless Chromium needs WebGL2; on Windows
  `--use-angle=d3d11` works). The app instance is exposed as `window.imageMasker`
  (`store.doc`, `store.selection`, `stage`, `exportBlob()`, ...).
* `docs/manual-smoke-test.md` is the manual checklist.
* Adding an emoji to the palette in `src/masks/emojiData.js` or changing a description means regenerating
  `src/masks/emojiEmbeddings.json` with `dev/emoji-embeddings.html` (the detector refuses an out-of-date file;
  vectors are matched by emoji, so reordering entries or changing themes needs no regeneration). It can be
  run headless: open the page and read `window.__emojiEmbeddings` once it is set (a few minutes).
* Emoji masks and stamps draw Twemoji or Google blob SVGs from jsDelivr (`src/raster/emojiArt.js`, pinned
  versions; style 0 Twemoji, 1 device font, 2 blobs) and fall back blobs → Twemoji → device font while they
  load or when offline; `exportBlob()` waits for them. The emoji picker (`src/ui/EmojiPicker.js`) loads the
  full emoji list from Emojibase on jsDelivr when first opened.
* The PictureGame Discord server's emojis (`:name:`, `src/masks/discordEmojis.js` + `images/discord-emojis/`)
  come from `scripts/fetch-discord-emojis.mjs`, run on picturegame-vm with the bot's config
  (`node fetch-discord-emojis.mjs /opt/pg/discord/config.json /tmp/out`; the token stays there), then copied back.
* Check that nothing leaves the screen at 320 px wide as well as on desktop: grids and stacks need
  `minmax(0, 1fr)` columns and inputs `min-width: 0`, or one wide control pushes a whole panel past the edge.

## Layout

See `docs/architecture.md`. Short version: `src/core` (immutable document + undo), `src/gl` (WebGL2
compositor, effects, patterns), `src/view` + `src/tools` (canvas interaction), `src/ui` + `src/app`
(panels and commands; App's commands are split over `src/app/*Commands.js` and mixed in). `old/v2/` and `old/` are archived previous versions: do not edit them.

## Conventions

* Never mutate the document. Use `store.apply(label, (doc) => next)` or `begin()/set()/end(label)`.
* Effect shaders work in units (short side of the picture = 1.0), never in pixels, so the preview and
  the full-resolution export match. GLSL ES 3.00: avoid reserved words such as `flat`, `sample`, `smooth`.
* Theme compatibility: keep the CSS variable names in `styles/main.css` and class names like
  `.panel-fieldset`, `.app-button`, `.tool-section`, `#settingsButton`; user JSON themes target them.
* localStorage keys (`rounds`, `masks`, `accessToken`, `imagemasker.*`) are shared with `old/v2/`; do not
  change their format. v3 sessions, locally saved rounds (no upload) and custom masks live in IndexedDB (`imagemasker-v3`, stores `sessions`, `assets`, `rounds`, `masks`).
* Custom masks can be stored on media.picturega.me (picturegame-media-gateway, `src/masks.mjs`, deployed
  separately on the NUC). `localStorage['imagemasker.mediaServer']` points the masker at a local gateway for testing.
  Never send round pictures there: RIS uploads go to third-party hosts only.
