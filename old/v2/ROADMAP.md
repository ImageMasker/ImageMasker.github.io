# ImageMasker Post-Refactor Roadmap

This document defines the next development roadmap for ImageMasker after the Fabric.js to PixiJS migration.

The migration is done. The app is now modular, Pixi-based, and already at feature parity with the legacy version. The goal of this roadmap is no longer "match the old site". The goal is to turn the new codebase into a meaningfully better editor.

This should be treated as an implementation document, not just a brainstorming list. Each phase below describes:
- what to build
- why it matters
- how it should fit the current architecture
- what risks to watch
- what "done" means

---

## Contents

1. [Project Goals](#1-project-goals)
2. [Current Baseline](#2-current-baseline)
3. [Roadmap Principles](#3-roadmap-principles)
4. [Strategic Priorities](#4-strategic-priorities)
5. [Target Architecture Additions](#5-target-architecture-additions)
6. [Phase A - Stability, Instrumentation, and UX Cleanup](#6-phase-a---stability-instrumentation-and-ux-cleanup)
7. [Phase B - Real Undo/Redo History](#7-phase-b---real-undoredo-history)
8. [Phase C - Layer Panel and Scene Management](#8-phase-c---layer-panel-and-scene-management)
9. [Phase D - Zoom, Pan, and Viewport Navigation](#9-phase-d---zoom-pan-and-viewport-navigation)
10. [Phase E - Text Tool 2.0](#10-phase-e---text-tool-20)
11. [Phase F - Non-Destructive Effect Stack](#11-phase-f---non-destructive-effect-stack)
12. [Phase G - Better Drawing and Selection](#12-phase-g---better-drawing-and-selection)
13. [Phase H - Export Presets and Output Workflow](#13-phase-h---export-presets-and-output-workflow)
14. [Phase I - Session Documents and Recovery](#14-phase-i---session-documents-and-recovery)
15. [Phase J - Advanced Anti-RIS and Pixi-Only Features](#15-phase-j---advanced-anti-ris-and-pixi-only-features)
16. [Phase K - UI Polish, Accessibility, and Mobile Improvements](#16-phase-k---ui-polish-accessibility-and-mobile-improvements)
17. [Phase L - Performance and Internal Quality](#17-phase-l---performance-and-internal-quality)
18. [Nice-to-Have / Long-Horizon Ideas](#18-nice-to-have--long-horizon-ideas)
19. [Recommended Delivery Order](#19-recommended-delivery-order)
20. [Master Checklist](#20-master-checklist)

---

## 1. Project Goals

The next version of ImageMasker should:

1. Stay simple enough to use in seconds.
2. Feel better than the old app, not merely equivalent.
3. Preserve the fast static-site deployment model.
4. Use PixiJS where it creates real product value, not just technical novelty.
5. Avoid bloating the interface with low-frequency controls unless they solve a real workflow problem.

The most important user story remains:

> "I want to load an image, mask it quickly, add a few edits, export it, and possibly post/save it, without fighting the UI."

That means improvements should favor:
- speed
- clarity
- recoverability
- better editing precision
- better export confidence

---

## 2. Current Baseline

The current Pixi app already provides:

- image loading from file, drag/drop, clipboard, and URL
- drawing and erasing
- preset masks, flags, and custom masks
- mask transforms and basic effects
- rectangle and text insertion
- selection, movement, resize handles, duplication, deletion
- upload, copy, download, RIS, Reddit, saved rounds
- theme toggle and mobile layout
- modular source structure under `src/`

Current important modules:

- `src/App.js`
- `src/core/CanvasEngine.js`
- `src/core/LayerManager.js`
- `src/core/HistoryManager.js`
- `src/tools/ToolManager.js`
- `src/tools/BrushTool.js`
- `src/tools/SelectTool.js`
- `src/tools/TextTool.js`
- `src/masks/MaskManager.js`
- `src/masks/MaskEffects.js`
- `src/ui/Toolbar.js`
- `src/ui/MaskPanel.js`
- `src/ui/CanvasArea.js`
- `src/ui/SavedRoundsPanel.js`

Current limitations:

- undo is still minimal
- there is no visible layer panel
- there is no viewport zoom/pan
- text controls are still basic
- effects are mostly one-off controls, not a reusable effect stack
- selection works, but scene editing still lacks professional workflow affordances
- export flow is functional, but not yet "confidence-building"
- there is no real session/document model

---

## 3. Roadmap Principles

These principles should govern all future work.

### 3.1 Preserve the static deployment model

No bundler, no app server, no build-only architecture unless there is an overwhelming reason.

The site should remain:
- static
- easy to host on GitHub Pages
- easy to run locally with a tiny HTTP server

### 3.2 Prefer architecture that compounds

Avoid one-off feature hacks. Build systems that support multiple future features.

Examples:
- a command-based history system is better than feature-specific undo code
- a generic effect stack is better than isolated hue/invert toggles
- a document model is better than ad hoc state scattered across tools

### 3.3 Keep the editor fast

Every new feature should be evaluated against:
- startup cost
- runtime cost
- export cost
- UI complexity cost

### 3.4 Default to non-destructive workflows

Pixi makes non-destructive editing more realistic than the old Fabric version.

When feasible:
- store parameters, not just rendered output
- keep effects editable
- separate source state from rendered state

### 3.5 UI controls must earn their space

ImageMasker succeeds partly because it is direct. Do not turn it into a generic bloated graphics app.

If a feature is rare but valuable:
- prefer collapsible advanced controls
- prefer keyboard shortcuts
- prefer contextual panels

---

## 4. Strategic Priorities

If development time is limited, prioritize in this order:

1. **Real undo/redo**
2. **Layer panel**
3. **Viewport zoom/pan**
4. **Text tool improvements**
5. **Effect stack**

These five areas create the biggest jump in usability and editor maturity.

---

## 5. Target Architecture Additions

The current structure is good, but several new modules should be introduced as the roadmap progresses.

### Proposed additions

```text
src/
  core/
    DocumentModel.js
    CommandHistory.js
    ViewportController.js
    SelectionManager.js
  layers/
    LayerSerializer.js
    LayerPanelController.js
  effects/
    EffectStack.js
    EffectRegistry.js
    filters/
      HueEffect.js
      InvertEffect.js
      BlurEffect.js
      GlowEffect.js
      DistortionEffect.js
      NoiseWarpEffect.js
  text/
    TextStylePanel.js
    FontRegistry.js
  export/
    ExportManager.js
    ExportPresets.js
  session/
    SessionStorage.js
    SessionSerializer.js
  ui/
    LayerPanel.js
    Toasts.js
    Dialogs.js
    InspectorPanel.js
```

Not all of these must be added immediately. The important point is to separate:

- scene/document state
- rendering state
- UI state
- persistence state

---

## 6. Phase A - Stability, Instrumentation, and UX Cleanup

### Goal

Make the current app feel less brittle before adding major features.

### Why first

The codebase is now large enough that new features will be easier to build if the current behavior is better observed and less dependent on alerts or silent assumptions.

### What to build

1. Replace browser `alert()` usage with lightweight toasts for:
   - upload success/failure
   - clipboard success/failure
   - save/update/delete status
   - RIS popup blocking
   - invalid URL input

2. Add a centralized error reporting helper:
   - `src/utils/reportError.js`
   - standardize user-facing messages
   - optionally log stack traces in development only

3. Add a small status strip or transient message area near the canvas.

4. Normalize button disabled states and loading labels.

5. Clean up small UX inconsistencies:
   - reset "Saved!" button states after delay
   - ensure upload-related controls never show in contradictory states
   - ensure all tool buttons reflect active mode reliably

### Architectural notes

- Introduce `Toasts.js` or `Notifier.js`.
- Prefer event-driven notifications via `EventBus`.

### Acceptance criteria

- No user-critical workflow relies on blocking alerts except browser/platform limitations.
- Async flows have visible loading and completion states.
- Repeated actions do not leave stale success styling behind.

---

## 7. Phase B - Real Undo/Redo History

### Goal

Replace the current minimal undo behavior with proper command-based undo/redo.

### Why it matters

This is the highest-value improvement after parity. Users need to trust the editor.

### Problems with the current state

The current history model effectively behaves like:
- "remove last non-drawing layer"

That is not enough for:
- moving an object
- resizing an object
- editing text
- tweaking mask effects
- drawing strokes
- deleting and restoring specific items

### What to build

Implement a command system:

```javascript
class Command {
  do() {}
  undo() {}
  redo() {}
}
```

### Commands to support

- `AddLayerCommand`
- `RemoveLayerCommand`
- `MoveObjectCommand`
- `ResizeObjectCommand`
- `UpdateOpacityCommand`
- `UpdateMaskEffectCommand`
- `EditTextCommand`
- `DrawStrokeCommand`
- `ClearDrawingCommand`
- `DuplicateObjectCommand`

### Requirements

1. Every user action that changes the scene should push a command.
2. Drag operations should coalesce into one history entry on pointer release, not one per move event.
3. Slider drags should also coalesce into one command when interaction finishes.
4. Redo stack should clear when a new command is committed after undo.
5. Add `Ctrl+Shift+Z` and `Ctrl+Y` for redo.

### Files likely affected

- replace or expand `src/core/HistoryManager.js`
- add `src/core/CommandHistory.js`
- tool modules must emit history-aware operations rather than mutating state blindly

### Risks

- drawing history can become memory-heavy
- effect changes can become noisy if every intermediate slider step creates entries

### Mitigation

- store stroke data, not bitmap snapshots, when possible
- commit interactive operations only at the end

### Acceptance criteria

- Undo/redo works for add, delete, move, resize, text edit, duplicate, and mask adjustments.
- Redo survives multiple sequential undos.
- Drawing history is usable and does not obviously tank performance.

---

## 8. Phase C - Layer Panel and Scene Management

### Goal

Give users explicit control over scene structure.

### Why it matters

The app now has multiple object types and non-trivial editing. A layer panel is the natural next step.

### What to build

Create a right-side or left-side `LayerPanel` showing the current scene stack.

Each layer row should support:
- selection
- rename
- hide/show
- lock/unlock
- reorder via buttons first, drag-and-drop later if desired
- delete

### Layer types to represent

- background image
- mask
- rectangle
- text
- drawing layer

### Minimum behavior

1. Clicking a layer row selects its object.
2. Hidden layers do not render.
3. Locked layers cannot be selected or edited.
4. Reordering changes render order and export order.
5. Layer names should be meaningful by default:
   - `Mask 1`
   - `Text 2`
   - `Rectangle 3`
   - `Brush Layer`

### Architectural notes

Current `LayerManager` should become the authoritative scene-order source, but it likely needs richer metadata:

```javascript
{
  id,
  name,
  type,
  container,
  visible,
  locked,
  selected,
  createdAt
}
```

### Important constraint

There should remain exactly one background layer and one drawing layer unless a future phase explicitly expands that model.

### Acceptance criteria

- Layers can be selected, renamed, hidden, locked, reordered, and deleted from the panel.
- Canvas selection and layer panel selection stay in sync.
- Export order matches panel order.

---

## 9. Phase D - Zoom, Pan, and Viewport Navigation

### Goal

Allow detailed editing without changing the export model.

### Why it matters

This is one of the biggest quality-of-life upgrades now that Pixi is available.

### What to build

Add a viewport controller for the editor view only.

Capabilities:
- zoom in/out with mouse wheel or buttons
- fit to screen
- 100% / actual-size mode
- click-and-drag pan with spacebar or middle mouse
- optional mini zoom indicator

### Important distinction

The viewport is not the document.

- document coordinates stay stable
- export still uses document/original image dimensions
- viewport transforms affect only how the user sees the scene

### Implementation notes

Do not scale individual scene objects for viewport zoom. Instead:
- create a dedicated viewport container
- render the background and editable content inside that container
- keep overlay UI aware of viewport transform

Suggested structure:

```text
stage
  viewportRoot
    backgroundSprite
    layerContainer
  overlayContainer
```

### Hard part

Selection overlays and editor inputs must account for viewport transform.

This is especially relevant for:
- resize handles
- text edit overlay positioning
- hit testing

### Acceptance criteria

- Users can zoom and pan without affecting export output.
- Selections and handles remain accurate under zoom.
- Text editing overlay still aligns correctly at non-100% zoom.

---

## 10. Phase E - Text Tool 2.0

### Goal

Make text feel like a real tool instead of a minimal annotation feature.

### What to build

Add a contextual text inspector with:
- font family
- font size
- weight
- italic
- fill color
- outline color
- outline width
- shadow toggle
- alignment
- multiline support

### Scope recommendation

Ship in two steps.

#### Step 1

- font family dropdown
- bold toggle
- outline color + width
- multiline editing

#### Step 2

- shadow
- alignment
- line height
- letter spacing

### Implementation notes

Current `TextTool` likely needs a richer style model:

```javascript
{
  text,
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  fill,
  stroke,
  strokeThickness,
  dropShadow,
  align,
  lineHeight,
  letterSpacing
}
```

Persist this in `__textData`.

### Pixi-specific opportunity

Pixi text styling makes outlines and shadows easier than in the old Fabric app. This is a real upgrade area.

### Acceptance criteria

- Users can create multiline text and edit it reliably.
- Text styles can be changed after creation.
- Styled text exports accurately.

---

## 11. Phase F - Non-Destructive Effect Stack

### Goal

Replace one-off mask effect handling with a generalized effect system.

### Why it matters

This is the biggest architectural opportunity unlocked by Pixi.

### Current state

Mask effects are effectively:
- opacity
- zoom
- angle
- hue
- invert

These work, but they are not yet organized as a reusable effect pipeline.

### What to build

Create an `EffectStack` abstraction:

```javascript
{
  targetId,
  effects: [
    { type: 'hue', enabled: true, value: 0.35 },
    { type: 'invert', enabled: true },
    { type: 'blur', enabled: false, radius: 2 }
  ]
}
```

### First supported effects

- hue
- invert
- blur
- alpha/opacity
- glow
- displacement/noise warp

### Later effects

- threshold/posterize
- color tint
- pixelation
- chromatic aberration
- wave distortion

### UI recommendation

Add an "Effects" section for the selected object, preferably contextual:
- visible when a mask is selected
- later expandable to shapes/text/background if desired

### Important principle

Do not mutate the original source image for effect changes. Update the effect definitions and rebuild Pixi filters.

### Acceptance criteria

- Multiple effects can be stacked and re-ordered or at least toggled independently.
- Effects remain editable after selection changes.
- Existing hue/invert controls are migrated to this system.

---

## 12. Phase G - Better Drawing and Selection

### Goal

Turn the current selection and brush systems from "works" into "comfortable".

### Drawing improvements

- brush stabilization / smoothing
- optional hard vs soft brush
- pressure support where available
- optional straight-line mode with Shift
- simple color swatches / recent colors

### Selection improvements

- better hit testing on small text
- visible selected-state inspector
- optional rotation handles
- arrow-key move nudging
- shift-modified larger nudges
- preserve selection after history operations where reasonable

### Multi-select

This phase is the natural place to introduce:
- shift-click multi-select
- group move
- group delete
- group duplicate

Full group/ungroup can come later; multi-select alone is already valuable.

### Acceptance criteria

- Selection feels reliable on masks, text, and rectangles.
- Small objects remain editable without frustration.
- Brush strokes feel smoother and more intentional.
- Multi-select, if added, behaves predictably.

---

## 13. Phase H - Export Presets and Output Workflow

### Goal

Make output predictable and flexible.

### What to build

Create an `ExportManager` that supports:
- original-resolution PNG
- JPEG export with quality slider
- clipboard copy
- size presets
- optional watermark-free preview of export parameters

### Suggested presets

- Original PNG
- Web JPG
- Reddit-friendly JPG
- Clipboard PNG

### Optional later additions

- trim transparent bounds for certain outputs
- flatten background/mask options
- export only selected object area

### Important distinction

Export should be a dedicated subsystem, not a collection of ad hoc calls from `App.js`.

### Acceptance criteria

- All current export behaviors remain.
- Preset selection changes only output parameters, never editor state.
- Export pipeline is centralized and testable.

---

## 14. Phase I - Session Documents and Recovery

### Goal

Let users recover work beyond uploaded URLs and saved rounds.

### What to build

Introduce a document/session model that can serialize:
- background image source
- mask state
- shapes/text
- drawing strokes
- layer order
- effect stack
- viewport state optionally

### Storage modes

#### Minimum

- autosave current session to localStorage
- restore on reload after explicit user prompt

#### Better

- named local sessions
- duplicate session
- delete session

### Important caveat

Storing full original image blobs in localStorage is not scalable.

Recommended approach:
- session metadata in localStorage
- optionally session JSON export/import as file
- for unsaved local images, warn that full recovery may be limited unless imported/exported explicitly

### Great future feature

Allow export/import of an `.imagemasker.json` document.

This would be the first true "project file" format for the app.

### Acceptance criteria

- Users can restore meaningful in-progress work after reload.
- Session data does not corrupt older saved rounds or existing localStorage keys.

---

## 15. Phase J - Advanced Anti-RIS and Pixi-Only Features

### Goal

Use PixiJS to build effects that were awkward or unrealistic in the Fabric version.

### Why this phase exists

The migration should eventually unlock features that justify the new rendering engine beyond maintainability.

### Candidate features

1. Procedural displacement distortion
2. Per-mask noise warp
3. Localized blur or mosaic overlays
4. Subtle lighting or shadow effects on masks
5. Blend modes:
   - multiply
   - screen
   - overlay
   - soft light
6. Text glow or edge treatment for readability
7. Animated preview-only effects if ever useful

### Important product warning

Anti-RIS features should improve obfuscation without making the image unusable or visually ugly.

This phase should be guided by restraint.

### Suggested first implementation

- displacement/noise warp slider on masks
- blur slider
- blend mode dropdown

### Acceptance criteria

- Advanced effects are optional and disabled by default.
- They export correctly.
- They do not noticeably degrade editor responsiveness on common image sizes.

---

## 16. Phase K - UI Polish, Accessibility, and Mobile Improvements

### Goal

Make the app feel more deliberate and less mechanically assembled.

### UI improvements

- clearer section grouping
- stronger active state styling
- better spacing rhythm
- consistent button sizing
- more contextual controls, fewer always-visible controls

### Mobile improvements

- collapsible tool sections
- sticky primary action bar
- larger selection handles on touch devices
- viewport gestures if feasible
- less vertical scrolling overhead

### Accessibility improvements

- keyboard reachable controls
- visible focus states
- better color contrast in both themes where needed
- `aria-label`s for icon-only buttons
- reduced-motion handling for any future animations

### Feedback improvements

- toasts instead of alerts
- inline validation errors
- explicit empty states
- better first-run guidance

### Acceptance criteria

- Mobile workflow requires less scrolling and fewer precision taps.
- Keyboard users can operate major flows.
- Important state changes are visible without intrusive alerts.

---

## 17. Phase L - Performance and Internal Quality

### Goal

Keep the app maintainable as features expand.

### What to improve

1. Reduce `App.js` centralization.
   - It currently wires too much.
   - Move feature-specific orchestration into dedicated controllers.

2. Normalize scene serialization.

3. Audit redraw paths.
   - selection overlay refreshes
   - text overlay positioning
   - export resize cycles
   - drawing texture rerenders

4. Add lightweight manual smoke-test docs.

5. Add optional development assertions.

### Areas to watch

- brush stroke memory growth
- effect filter churn
- object cloning correctness
- viewport math drift
- export vs editor state leaks

### Acceptance criteria

- New features do not force `App.js` into an even larger monolith.
- Render performance remains acceptable with multiple objects and effects.
- Common editor flows do not accumulate obvious state bugs.

---

## 18. Nice-to-Have / Long-Horizon Ideas

These are not core roadmap items, but they become plausible with the new architecture.

### 18.1 Template system

User-defined reusable setups:
- favorite mask combos
- preferred export presets
- standard text styles

### 18.2 Custom keyboard shortcut settings

Likely low priority, but possible later.

### 18.3 Plugin-like effect presets

Probably overkill for now, but the effect stack could eventually support user-selectable presets.

### 18.4 Project import/export bundle

An archive containing:
- document JSON
- embedded local images
- metadata

### 18.5 Guided mode / simplified UI

A compact mode for users who only want:
- upload
- mask
- draw
- export

### 18.6 Compare mode

Temporarily toggle:
- original image
- masked image
- split comparison

Useful for fine-tuning readability vs concealment.

---

## 19. Recommended Delivery Order

If implementing this roadmap incrementally, the recommended order is:

1. Phase A - stability and UX cleanup
2. Phase B - real undo/redo
3. Phase C - layer panel
4. Phase D - zoom/pan
5. Phase E - text tool 2.0
6. Phase F - effect stack
7. Phase G - drawing and selection improvements
8. Phase H - export workflow
9. Phase I - session documents
10. Phase J - advanced Pixi-only effects
11. Phase K - UI/accessibility/mobile pass
12. Phase L - performance/internal cleanup throughout

This sequence is intentional:
- first improve trust and editing comfort
- then improve structure and precision
- then improve power features
- then add ambitious Pixi-only capabilities

---

## 20. Master Checklist

Use this as the high-level roadmap tracker.

### Phase A
- [x] Replace alerts with toasts where practical
- [x] Add centralized user-facing error/status notifications
- [x] Normalize loading/disabled/success button states
- [x] Clean up small inconsistent UI states

### Phase B
- [x] Introduce real undo/redo stack
- [x] Undo/redo move operations
- [x] Undo/redo resize operations
- [x] Undo/redo text edits
- [x] Undo/redo mask effect changes
- [x] Undo/redo drawing strokes
- [x] Add redo shortcut support

### Phase C
- [x] Add visible layer panel
- [x] Select layer from panel
- [x] Rename layer
- [x] Hide/show layer
- [x] Lock/unlock layer
- [x] Reorder layer
- [x] Keep canvas selection and panel selection synchronized

### Phase D
- [x] Add viewport zoom
- [x] Add viewport pan
- [x] Add fit-to-screen
- [x] Add 100% view mode
- [x] Keep selection overlays accurate under zoom
- [x] Keep text editing aligned under zoom

### Phase E
- [x] Add richer text style model
- [x] Add multiline text editing
- [x] Add font family controls
- [x] Add bold/italic controls
- [x] Add outline controls
- [x] Add shadow controls
- [x] Add alignment controls

### Phase F
- [x] Create reusable effect stack abstraction
- [x] Migrate hue/invert into effect stack
- [x] Add blur effect
- [ ] Add glow effect
- [x] Add displacement/noise warp effect
- [x] Add effect toggles and persistence

### Phase G
- [x] Improve brush smoothing/stabilization
- [x] Add better selection feedback
- [x] Add arrow-key move nudging
- [x] Add multi-select
- [x] Add group move/delete/duplicate behavior
- [x] Consider rotation handles

### Phase H
- [x] Centralize export logic in ExportManager
- [x] Add export presets
- [x] Add JPEG quality option
- [x] Keep original-resolution PNG export
- [x] Keep clipboard and download flows consistent

### Phase I
- [x] Add autosave session support
- [x] Add restore-session prompt
- [x] Add named local sessions
- [x] Add session delete/duplicate
- [x] Add project JSON import/export

### Phase J
- [x] Add advanced anti-RIS displacement effect
- [x] Add blend modes
- [x] Add optional localized blur/pixelation tools
- [x] Ensure advanced effects export correctly

### Phase K
- [x] Improve layout and control grouping
- [x] Improve mobile editing ergonomics
- [x] Improve focus states and accessibility
- [x] Replace intrusive feedback with inline or toast feedback
- [x] Add better first-run/empty-state help

### Phase L
- [x] Reduce `App.js` orchestration load
- [x] Add document/state abstractions
- [x] Audit render/update hotspots
- [x] Add manual smoke-test documentation
- [x] Keep performance acceptable as features expand

---

## Closing Note

The migration to PixiJS should not only preserve ImageMasker; it should widen the design space.

The best next features are not flashy for their own sake. They are the ones that make the editor:
- safer to use
- faster to recover from mistakes
- easier to operate precisely
- more expressive without becoming cluttered

That is the standard this roadmap should be held to.
