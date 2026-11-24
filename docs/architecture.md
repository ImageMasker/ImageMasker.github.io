# Architecture (v3)

Static site, native ES modules, no dependencies and no build step. WebGL2 is required.

```text
index.html, styles/          shell and theme (CSS variables, same names as v2 so JSON themes keep working)
src/main.js                  boots App
src/app/App.js               layout, shared services, editing commands
src/app/*Commands.js         more App commands, split by topic (collage, random mask, RIS, share,
                             sessions) and mixed into App (mixin.js), so callers still use app.x()
src/app/sessions.js          IndexedDB sessions, autosave, JSON export/import
src/app/settingsUi.js        settings dialog (sessions, themes, shortcuts, about)
src/app/backgroundRemoval.js background removal into a new layer, optionally inside a lasso outline (tools/LassoTool.js)
src/app/randomMask.js        Random mask recipes, strengths and kinds
src/app/strengthMeter.js     internal "how different does it look" score the random mask aims with
src/collage/                 collage geometry (cuts → pieces, gaps, presets) and Canvas 2D drawing
src/core/model.js            the document: plain immutable data + layer factories
src/core/Store.js            current document, selection, undo/redo
src/core/AssetStore.js       decoded images, referenced from layers by id
src/core/geometry.js         2D affine helpers
src/gl/GL.js                 WebGL2 helper (programs, pooled render targets)
src/gl/Compositor.js         document -> pixels
src/gl/glsl.js               shared GLSL, blend modes, system shaders
src/gl/effects.js            effect masks (one fragment shader each)
src/gl/patterns.js           procedural overlay patterns
src/gl/StrokeRenderer.js     brush, eraser and stamp strokes drawn on the GPU at any scale
src/raster/                  stroke and stamp geometry (strokes.js), Canvas 2D rasterisers for text, shapes and arrows
                             (shapes.js), emoji mask
                             tiles and repeated image masks, and the emoji artwork they draw (emojiArt.js:
                             Twemoji, Google blobs, server)
src/masks/                   classic, flag and emoji mask data (emojiData.js, pictureEmojis.js, emojiEmbeddings.json), the
                             PictureGame Discord server's emojis (discordEmojis.js, images/discord-emojis/)
src/view/Stage.js            canvas, zoom/pan, render loop, pointer input
src/tools/                   select, brush/eraser/effect brush, region, shapes, arrow, crop, emoji stamp, crop-RIS box,
                             text editor
src/ui/                      panels (library, layers, properties, share, ...), the emoji picker, Rounds and Collage
                             dialogs (Modal.js), header ▾ menus (Dropdown.js)
src/integrations/, storage/  image hosts, RIS, Reddit, background removal model, localStorage wrappers,
                             custom masks in IndexedDB (CustomMasks) and on media.picturega.me (MaskServer)
dev/effect-sheet.html        contact sheet of every effect/pattern + shader errors
dev/tests.html               in-browser tests of the document model, undo, geometry and collage cuts
dev/emoji-embeddings.html    regenerates src/masks/emojiEmbeddings.json from the emoji descriptions
old/v2/, old/                previous versions, kept working
```

## Document and history

The document is `{ width, height, layers: [bottom ... top] }` in picture pixels. Edits never mutate it:
`store.apply(label, (doc) => nextDoc)` for one-shot changes, or `store.begin()` / `store.set()` /
`store.end(label)` around a drag or slider scrub so the whole gesture is one undo step. Unchanged
layers are shared between history entries, and pictures live in the `AssetStore`, so undo is cheap.

Any layer can have `erased` strokes (document pixels, drawn by the eraser's *Erase selected layer* mode):
the compositor takes the layer back out wherever they cover it (`Compositor.eraseFrom`). They stay in
place when the layer moves, shift with a crop and are dropped when the base picture is replaced.

Layer types: `image`, `mask` (`source: 'asset' | 'pattern' | 'emoji'`), `effect`, `drawing`, `text`, `shape`,
`arrow`, and `rect` (filled rectangles from before the Shapes tool, still drawn).
Shapes (`kind`: ellipse, rect, triangle, star, heart; `fill`: outline | fill) and arrows are drawn with Canvas 2D
by `raster/shapes.js` into a texture the size the layer is shown, like text. `style: 'organic'` (hand-drawn, the
default) draws one tapering marker stroke that wobbles and overshoots its start, from the layer's `seed`. `width`
is the line width in document pixels. An arrow keeps its ends inside its box (`points`, -0.5..0.5) and a `bend`
(how far the curve's control point is pushed sideways, as a fraction of the distance between the ends) and
a `lean` (how far it is pushed along the arrow), so the middle handle can be dragged anywhere and the curve passes
through it (`curveThrough`). A drawn arrow fits bend and lean to the dragged path (`fitCurve`); a mostly straight
drag gives a straight arrow. `placeArrow()` refits the box around the curve whenever the ends, bend, head or width
change, and the Move tool shows handles for both ends and the curve instead of the box handles. Arrows are hit only
near their line.

The Shapes, Arrow, Region and Text tools stay selected after placing something (`tools/PlacingTool.js`), and
lend the Move tool's handles to the layer just placed: a drag that starts on a handle edits it instead.

An effect layer's `coverage` is `full`, `rect`, `ellipse`, `polygon` or `paint`. The hidden effect id
`original` (used by the eraser's reveal mode) shows the base picture instead of running a shader;
`insertMask()` keeps such layers on top when masks are added.

A collage keeps its picture areas on the base layer (`cells: [{ points }]`, document pixels).
Any other layer can be limited to one piece with `clip: { piece, points }` (flat document pixels);
the compositor keeps that layer's result only inside the polygon, and hit-testing ignores it outside.
Random mask gives every piece (or only the piece chosen under *Masks → Add to*) its own layers with
`clip`; effects are also fitted to the piece (`polygon` coverage) so centred effects centre on it.
Cropping shifts `cells` and `clip`, but the collage tools are hidden once the canvas size changes.

Any layer can have `clipBelow: true` (the ↳ button in the Layers list): its result is kept only where
the nearest layer under it that is not clipped itself has pixels (`Compositor.clipBase` / `layerShape`),
like a clipping mask. Clipping to the base picture or to an effect does nothing.

An emoji mask (`source: 'emoji'`) keeps its `emojis`, `params` (see `EMOJI_MASK`) and `seed`; the
compositor draws one seamless tile with `raster/emoji.js` at about the resolution the box is shown at
and wraps it across the picture. Density is the number of rows in the tile; the emoji size does not
depend on it. `params.style` picks the artwork (`raster/emojiArt.js`): 0 Twemoji, 1 the device's font,
2 Google's blobs; missing artwork falls back down that list. `:name:` entries are the PictureGame
server's emojis, always drawn from `images/discord-emojis/`. Emojis are chosen in `ui/EmojiPicker.js`
(search, categories, recently used, every Unicode emoji from Emojibase). The stamp tool adds `{ tool: 'stamp', emoji, size, angle, spin, style, points }` strokes to a
drawing layer, so stamps erase, undo and save like brush strokes.

A repeated image mask (`repeat: { rows, size, stagger, wobble, warp, seed }`, `raster/repeat.js`) draws
the image small in staggered rows; `rows` (Density) only spaces the copies, `size` sizes them, and
`wobble` / `warp` tilt and bend each copy on its own. Community masks carry `use: 'image' | 'pattern'`,
set by the moderator, which decides how a click adds them. *From the picture* (`app/emojiFromPicture.js`,
`integrations/EmojiDetector.js`) runs MobileCLIP S0's image model (fp16; the 8-bit one gives wrong
results) through Transformers.js from jsDelivr, and compares the picture with text embeddings of about
800 emoji descriptions (the palette without its symbols, plus `masks/pictureEmojis.js`) that were computed
once and shipped in `masks/emojiEmbeddings.json`. The model sees a square, so it looks at both its own middle
crop and the whole picture letterboxed on grey, averaged. It takes every emoji the picture matches at least a
tenth as well as the best one (up to five), then, while it has fewer than three, close relatives of those
(descriptions near each other in the text embedding: 🐴 → 🐎) that the picture still somewhat matches. Unrelated
fillers are never added, so one clear subject can give one or two emojis.

## Rendering

`Compositor.render(doc, { scale })` folds the layers bottom-to-top into an accumulator texture:

* content layers are drawn through their inverse transform and blended over it;
* effect layers run a shader over what is already there, then mix the result back through their
  coverage (analytic rectangle/ellipse, a polygon texture, or painted strokes).

Strokes (drawing layers, painted effects, `erased` areas) are not rasterised on the CPU: `raster/strokes.js`
turns each one into line pieces, dots and stamp placements in document pixels (cached per stroke object), and
`gl/StrokeRenderer.js` draws them straight into a render target at the scale being rendered, anti-aliased in
the fragment shader. So a full-size export costs no more than the preview, and nothing is kept between
them but a small vertex buffer per layer. Opaque strokes are drawn in batches; a see-through stroke is drawn
alone into a scratch target with `MAX` blending, then laid down once, so it does not darken where it overlaps
itself (as in Canvas 2D). Stamps are textured quads; their emoji is drawn with `drawEmoji` into a texture
sized to how big it is shown.

The preview renders at roughly screen resolution (`Stage.pickScale`), the export at scale 1 with the
same code. To keep both identical, effect shaders work in *units* where the picture's short side is
1.0 and never in pixels. Colours are premultiplied; every texture stores row 0 = top of the image.

## Adding an effect

Add an entry to `EFFECTS` in `src/gl/effects.js`:

```js
{
  id: 'myEffect',
  name: 'My effect',
  cat: 'warp',            // see EFFECT_CATEGORIES
  strength: 2,            // 1-3, how hard it scrambles the picture (shown on the tile)
  seeded: true,           // uses uSeed -> gets a Shuffle button
  centered: true,         // uses uCenter / uExtent
  thumb: { size: 6 },     // optional parameter overrides for the small gallery preview
  main: ['size'],         // optional: sliders shown up front (default: first three), the rest go under "More"
  params: [R('size', 'Size', 1, 40, 10)],
  frag: `vec4 fx(vec2 q) { return S(q + sin(q.yx * p_size) * 0.01); }`,
}
```

`q` is the position in units, `S(q)` samples the picture below, each parameter becomes a `p_<key>`
uniform. The properties UI, the gallery tile, sessions and the effect brush pick it up automatically.
Add the effect to `INTENSITY` (same file) with the sliders Gentle / Strong should scale; the effect
sheet reports an error if the three presets come out identical. A `centered` effect gets a draggable
centre, stored as `layer.center` in the layer's local box.
Open `dev/effect-sheet.html?only=myEffect` to see it and any compile error.

Patterns in `src/gl/patterns.js` work the same way with `vec4 pattern(vec2 p)`. List size parameters
(line width, dot size) in `fixed` so Density keeps them the same size on the picture.
