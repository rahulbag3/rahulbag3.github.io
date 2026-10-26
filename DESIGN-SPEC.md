# Design Specification — Rahul, Developer Portfolio

Reference analysed: `https://www.igloo.inc/`
Method: REA-style reverse engineering with the `leanrea` skill workflow (static asset
retrieval + headless browser DOM/CSS/network inspection). No guessing — every claim below
is either marked **seen** (with the evidence) or **inferred**. Anything not observable is
marked **limitation**.

---

## 1. What Igloo actually is (the evidence)

| Observation | Evidence | Status |
|---|---|---|
| Single-page app, body is empty in raw HTML | `curl https://www.igloo.inc/` → `1410` bytes, `<body></body>`, one module script `assets/index-2e130bc1.js` | seen |
| It is a WebGL / Three.js experience, not a normal document | `#webgl` container div; a `canvas` is created at runtime | seen |
| Scroll is the primary navigation axis | loaded assets `assets/images/scroll-datatexture.ktx2`, plus `scrollTrigger` symbol in `App3D-d68cb154.js` | seen |
| Scene is streamed from compressed geometry + GPU textures | 73 network requests: `.drc` (Draco geometry), `.ktx2` (Basis/KTX2), `draco_decoder.wasm`, `basis_transcoder.wasm`, `msdfworker`, `exrworker`, `bitmapworker` | seen |
| Two top-level sections exist | bundle strings `"home"`, `"projects"`, and a transition name `"enter-project"` | seen |
| Chrome is minimal: sound, close, arrow, logo, "visit" | UI data textures `ui/sound-`, `ui/close-`, `ui/arrow-`, `ui/logo-`, `ui/visit-datatexture.ktx2` | seen |
| Motion is interpolated, not snapped | `lerp`, `damp`, `smoothstep`, `smootherstep`, `lerpCoefFPS`, GSAP markers (`smoothChildTiming`, `easeEach`) | seen |
| Content is revealed as art-directed "chapters" made of 3D objects | geometries: `igloo`, `cubes/cube1..3`, `mountain`, `ground`, `shattered_ring`, `pudgy`, `overpass_logo`, `blurrytext` | seen |
| Typeface is a mono | `@font-face` `IBMPlexMono-Regular` / `IBMPlexMono-Medium` (woff2+woff), and `--default-font: sans-serif` set but unused for the scene text | seen |
| Canvas colour is a muted slate, not white or black | `--bgColor: #A0A5B1` | seen |
| A text/ASCII loader is used | inline `<style>` with an `@keyframes head` that cycles `content` between `---===+++` and `------===+` | seen |

### Visual principles worth carrying over (the *why*, not the pixels)
1. **One deliberate canvas colour** dominates everything; contrast comes from content, not chrome.
   Igloo is `#A0A5B1`; the palette is otherwise desaturated steel.
2. **Monospace as identity.** A technical, instrument-like voice. Precision over friendliness.
3. **Accent is rationed.** Real material colours in the bundle are cold greys/blues
   (`#67707E`, `#A1AAB7`, `#d1d6e3`, `#b5d5ff`, `#222b42`, `#09121f`) with a *small* warm note
   (`#cda05e`, `#ab8349`, `#904619`). Colour is never sprayed around.
4. **Scroll is the narrative.** Numbered, staged reveals; a section is a chapter, not a card.
5. **Composited motion.** Everything eases (lerp/damp) with frames-per-second-aware smoothing.
6. **Minimal, tiny affordances.** Sound, close, arrow — small marks, never buttons with chrome.
7. **A loading state that is part of the brand** ("it boots like an instrument").

### Limitations (documented, not invented)
- The full 3D scene **could not be observed**. In headless Chrome it threw
  `RangeError: Maximum call stack size exceeded at nF.update (App3D-...js:7101)` and parked on
  the loader. The screenshot confirms only the slate background + ASCII loader.
- Therefore camera choreography, chapter sequencing, exact layout of the `home` / `projects`
  views, and the hover/resize behaviour of the 3D scene are **unknown**.
- Igloo's site is a decorative 3D world with **no portfolio content model** — it offers design
  *principle*, not a content structure. This portfolio therefore borrows the principles only.

---

## 2. Translation into an original identity

> **Placement.** The working directory already contained a working Vite/Three.js game at its
> root and an Android project beside it. Nothing was overwritten or refactored: this build is a
> self-contained static site in the pre-existing empty `website/` directory, which keeps the
> game's tooling untouched and the portfolio deployable on its own.

The site adopts Igloo's *real* visual language rather than a reinterpretation of it — the same
slate canvas, the same monospace voice, the same rationed accent, the same scroll-driven 3D
backdrop — and then spends that language on content Igloo never has: real, verifiable
repositories.

**Identity: "Slate Instrument" — a spec sheet drawn on the reference's own canvas.**

| Token | Value | Role |
|---|---|---|
| `--bg` | `#A0A5B1` | canvas — **the reference colour, verbatim** |
| `--bg-2` | `#AAB0BB` | raised surface: screenshot frames, inputs |
| `--bg-3` | `#B6BBC5` | raised further: input hover |
| `--line` | `rgba(12,17,25,.16)` | hairline rules |
| `--line-2` | `rgba(12,17,25,.34)` | stronger rules and borders |
| `--ink` | `#0C1119` | primary text — **7.7:1** on `--bg` |
| `--ink-2` | `#2B3240` | secondary text — 5.2:1 |
| `--ink-3` | `#333941` | meta and labels — 4.7:1 (never long prose) |
| `--accent` | `#4E2E06` | brass, darkened until it passes as body text — 4.93:1 |
| `--accent-lg` | `#6E4208` | the same hue at 3.45:1 — display sizes only (AA large) |
| `--accent-mark` | `#904619` | the reference's brass, decorative marks only, never text |

**The one deliberate departure: ink polarity.** Igloo sets light text on the slate canvas. That
measures about **2.2:1** and is genuinely unreadable, so this build inverts polarity and sets
dark ink on the same slate. Every colour above is therefore chosen to pass WCAG AA *against
`#A0A5B1`*, which is the constraint the rest of the palette is derived from.

**Type**
- **IBM Plex Mono only** (400 / 500 / 600), loaded from Google Fonts with `preconnect` and
  `display=swap`, over a full system fallback stack. There is no display sans: the reference's
  entire voice is the mono, and a second family would dilute it.
- Display sizes use tight negative tracking (`-0.035em`), mirroring the reference's large mono
  headline setting; labels use wide positive tracking (`0.16em`) as small caps.

**Wordmark and favicon**
- The logotype is **not an image**. `index.html` ships a hand-built 5×7 cell font as five SVG
  `<path>` glyphs (`#px-R #px-A #px-H #px-U #px-L`) and composes `RAHUL` from `<use>` elements in
  a `viewBox="0 0 29 7"` with `shape-rendering="crispEdges"`. The favicon is the same `R` glyph.
  Nothing to load, crisp at any size, and it matches the instrument voice.

**The 3D layer** (`assets/js/scene.js`, Three.js vendored — see §3)
- A single fixed, full-bleed `<canvas>` sits behind all scrolling content, `aria-hidden`, never
  interactive. It is a **lattice world**: a displaced wireframe terrain plane plus a nested
  wireframe solid (icosahedron shell, icosahedron core, octahedron facet), `Points` node markers,
  and a ground ring, all under distance fog that fades the world into the canvas colour.
- **Scroll is the camera.** Seven `STATIONS` are keyed to document scroll progress; camera orbit,
  radius, height, look-at height, object offset, scale, yaw and drop are interpolated between the
  two bracketing stations with a **smootherstep** easing. A damped `lerp` chases the target every
  frame, so scroll impulses are never shown directly. Pointer position adds a small damped
  parallax.
- **Per-station weight (`fade`).** The solid is a hero at rest and becomes a quiet ghost once it
  is sitting behind body copy. Only the solid fades; the terrain keeps constant weight so the
  ground still reads as continuous landscape underneath the text.

**Scene legibility contract (hard rule).** Every colour used inside the WebGL scene is tested
against `--ink` (`#0C1119`) and must reach **≥ 4.5:1**. The dimmest scene colour is `#7A8494`.
There is no dark core, no shadow, and no warm accent in 3D — brass is a DOM-only text token.
This keeps the canvas decorative without ever fighting the copy for contrast.

**Motion contract**
- `prefers-reduced-motion: reduce` → the scene renders **one still frame** at the current scroll
  position and never starts a loop; reveals resolve immediately; smooth scrolling is disabled.
- `navigator.connection.saveData`, a 2G/slow link, or no WebGL → the scene module is **never
  imported**; the DOM falls back to the flat slate canvas.
- The loop is paused when the tab is hidden or the canvas is off-screen, and the scene is
  disposed (geometry, materials, renderer) on teardown. `devicePixelRatio` is capped at 1.6.

**Structure (chapters, numbered like a spec)**
```
01  MANIFEST     hero — stamp, statement, chapter label, live data-source line
02  WORK         featured projects + full filterable repository index
03  SIGNAL       public GitHub activity (real events, real timestamps)
04  ABOUT        short, personal, verified facts only
05  BUILDING     "now building" — only repos that are explicitly unfinished
06  CONTACT      verified links only (GitHub)
```
A fixed corner chip tracks `01 / 06 · Name` and a hairline progress bar tracks scroll, and the chip
stands down once the footer reaches the viewport so the two never overprint each other; a boot
screen (ASCII mark + status lines) covers the first paint and is removed as soon as the document
is interactive — with JavaScript off it never appears at all.

**Explicitly avoided** (per brief): gradients, glassmorphism, glow, oversized rounded cards,
dashboard chrome, animation libraries, placeholder sections, invented metrics.

---

## 3. Content model

Source of truth: `https://api.github.com/users/rahulbag3/repos` (verified live).
Curated overlay adds only *verified* facts (featured ranking, screenshot URLs that return
HTTP 200, an editorial note derived from each repo's own README). No stars-based ranking —
all five repos have `0` stars, so ranking uses **completeness, code size, recency and README
quality**, which is the honest signal here.

```
website/
  index.html
  assets/css/styles.css
  assets/js/data.js        # retrieval: GitHub API + normalisation + cache + fallback
  assets/js/curation.js    # curated, verified editorial overlay
  assets/js/render.js      # pure DOM builders (presentation)
  assets/js/scene.js       # Three.js lattice world (scroll-driven 3D backdrop)
  assets/js/app.js         # controller: boot, scene lifecycle, nav, filters, reveal
  assets/data/snapshot.js  # committed snapshot (real API output) used as fallback
  assets/vendor/three/     # vendored three.module.min.js v0.169.0 + LICENSE
  assets/favicon.svg
  assets/og.png            # 1200x630 social card
  tools/snapshot.mjs       # regenerates the snapshot from the live API
  tools/og.html            # source for assets/og.png
  README.md
  DESIGN-SPEC.md
```

Separation: **retrieval** (`data.js`) / **content** (`curation.js` + snapshot) /
**presentation** (`render.js`) / **behaviour** (`app.js` + `scene.js`).

**No build step, no framework, no backend.** All API strings are written through `textContent`,
so remote data can never become markup. The data chain is
`localStorage cache → live GitHub API → committed snapshot`, and the UI always states which link
answered (`live · GitHub API`, `recent fetch · GitHub API`, or the snapshot).

**Three.js is vendored, not bundled.** `assets/vendor/three/three.module.min.js` (v0.169.0, with
its `LICENSE`) is imported with a dynamic `import()` from `scene.js` **only** when the motion and
network contracts above permit it. The site therefore stays dependency-free at load, works
offline, and needs no toolchain.

---

## 4. Verification performed

| Check | Result |
|---|---|
| Horizontal overflow, 320 → 1440 px | none (`scrollWidth === clientWidth`) |
| Grid tracks per breakpoint | verified at each width (feature 3→2→1 col, rows 4→1 col, chapter head 2→1 col) |
| All 5 repositories rendered from the live API | yes, plus 10 real screenshots |
| Filters (category chip, language select, search) and empty state | pass |
| "Reset filters" button | pass (caught and fixed a real bug: `node.onClick` is not a handler) |
| Mobile menu open / Escape close / `aria-expanded` | pass |
| Anchors resolve, external links carry `rel="noopener"` | pass |
| Images: `alt`, intrinsic `width`/`height`, `loading="lazy"` | 10/10 |
| Every `[data-reveal]` element becomes visible after a full scroll | 35/35, none stuck at `opacity: 0` |
| 3D scene: canvas sized, animates, scroll-mapped, pointer-reactive | confirmed; scene colours all ≥ 4.5:1 vs `--ink` |
| Scene skipped for reduced-motion / `saveData` / no WebGL | renders a single still frame or nothing; DOM unchanged |
| Index chip + scroll progress tracking | 01 → 06, progress 0 → 1 |
| Fallbacks: rate limit `403`, network error, empty payload | all three resolve to the snapshot with the right message |
| Fallback cache: hit, expiry, and behaviour with the network down | pass |
| Unusable/empty events feed | degrades to commit recency and says so |
| Lighthouse accessibility / best-practices / SEO | 100 / 100 / 100 |
| Uncaught console errors | none |

Honest limitation: the reference site's 3D scene could not be observed headlessly, so the
*camera work and chapter choreography* of Igloo are referenced only as principles, never copied.
Similarly, `og:url` and `og:image` remain relative until a deployment domain exists (documented
in the README) because inventing a URL would be worse than leaving one relative.
