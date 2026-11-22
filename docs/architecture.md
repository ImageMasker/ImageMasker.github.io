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
src/app/backgroundRemoval.js background removal into a new layer
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
src/raster/                  Canvas 2D rasterisers for strokes and text
src/view/Stage.js            canvas, zoom/pan, render loop, pointer input
src/tools/                   select, brush/eraser/effect brush, region, crop, crop-RIS box, text editor
src/ui/                      panels (library, layers, properties, share, ...), Rounds and Collage
                             dialogs (Modal.js), header ▾ menus (Dropdown.js)
src/integrations/, storage/  image hosts, RIS, Reddit, background removal model, localStorage wrappers
dev/effect-sheet.html        contact sheet of every effect/pattern + shader errors
dev/tests.html               in-browser tests of the document model, undo, geometry and collage cuts
old/v2/, old/                previous versions, kept working
```

## Document and history

The document is `{ width, height, layers: [bottom ... top] }` in picture pixels. Edits never mutate it:
`store.apply(label, (doc) => nextDoc)` for one-shot changes, or `store.begin()` / `store.set()` /
`store.end(label)` around a drag or slider scrub so the whole gesture is one undo step. Unchanged
layers are shared between history entries, and pictures live in the `AssetStore`, so undo is cheap.

Layer types: `image`, `mask` (`source: 'asset' | 'pattern'`), `effect`, `drawing`, `text`, `rect`.
An effect layer's `coverage` is `full`, `rect`, `ellipse`, `polygon` or `paint`. The hidden effect id
`original` (used by the eraser's reveal mode) shows the base picture instead of running a shader;
`insertMask()` keeps such layers on top when masks are added.

A collage keeps its picture areas on the base layer (`cells: [{ points }]`, document pixels).
Any other layer can be limited to one piece with `clip: { piece, points }` (flat document pixels);
the compositor keeps that layer's result only inside the polygon, and hit-testing ignores it outside.
Random mask gives every piece (or only the piece chosen under *Masks → Add to*) its own layers with
`clip`; effects are also fitted to the piece (`polygon` coverage) so centred effects centre on it.
Cropping shifts `cells` and `clip`, but the collage tools are hidden once the canvas size changes.

## Rendering

`Compositor.render(doc, { scale })` folds the layers bottom-to-top into an accumulator texture:

* content layers are drawn through their inverse transform and blended over it;
* effect layers run a shader over what is already there, then mix the result back through their
  coverage (analytic rectangle/ellipse, a polygon texture, or a painted stroke texture).

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
