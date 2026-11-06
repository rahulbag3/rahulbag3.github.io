# Design Specification — Rahul, Developer Portfolio

Live at `https://rahulbag3.github.io/`. A single-page, static portfolio that reads public
repositories from the GitHub API and presents them as a technical spec sheet. Every claim on the
page is either written in `index.html` or read from GitHub at runtime; nothing is invented.

---

## 1. Design intent

The site should read like an instrument's spec sheet, not a marketing page:

1. **One deliberate canvas colour.** A muted slate dominates; contrast comes from content, not
   chrome. The palette is otherwise desaturated steel.
2. **Monospace as identity.** A technical, instrument-like voice. Precision over friendliness.
3. **Accent is rationed.** A single warm brass note, used as a mark rather than decoration.
4. **Scroll is the narrative.** Numbered sections, staged reveals; a section is a chapter, not
   a card.
5. **Composited motion.** Everything eases with damped interpolation instead of snapping.
6. **Minimal, tiny affordances.** Small marks, hairline rules, no buttons with chrome.
7. **A loading state that is part of the brand** — the page boots like an instrument.

**Identity: "Slate Instrument" — a spec sheet drawn on one canvas colour.**

The design is self-contained. No third-party template, theme, or design system is used.

---

## 2. Visual system

### Colour tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#A0A5B1` | canvas |
| `--bg-2` | `#AAB0BB` | raised surface: screenshot frames, inputs |
| `--bg-3` | `#B6BBC5` | raised further: input hover |
| `--line` | `rgba(12,17,25,.16)` | hairline rules |
| `--line-2` | `rgba(12,17,25,.34)` | stronger rules and borders |
| `--ink` | `#0C1119` | primary text — **7.7:1** on `--bg` |
| `--ink-2` | `#2B3240` | secondary text — 5.2:1 |
| `--ink-3` | `#333941` | meta and labels — 4.7:1 (never long prose) |
| `--accent` | `#4E2E06` | brass, darkened until it passes as body text — 4.93:1 |
| `--accent-lg` | `#6E4208` | the same hue at 3.45:1 — display sizes only (AA large) |
| `--accent-mark` | `#904619` | brass, decorative marks only, never text |

Dark ink is set on the slate canvas, and every colour above is chosen to pass WCAG AA **against
`#A0A5B1`**, which is the constraint the rest of the palette is derived from.

### Type

- **IBM Plex Mono only** (400 / 500 / 600), loaded from Google Fonts with `preconnect` and
  `display=swap`, over a full system fallback stack. There is no display sans: the entire voice
  is the mono, and a second family would dilute it.
- Display sizes use tight negative tracking (`-0.035em`); labels use wide positive tracking
  (`0.16em`) as small caps.

### Wordmark and favicon

- The logotype is **not an image**. `index.html` ships a hand-built 5×7 cell font as five SVG
  `<path>` glyphs (`#px-R #px-A #px-H #px-U #px-L`) and composes `RAHUL` from `<use>` elements in
  a `viewBox="0 0 29 7"` with `shape-rendering="crispEdges"`. The favicon is the same `R` glyph.
  Nothing to load, crisp at any size, and it matches the instrument voice.

---

## 3. The 3D layer

`assets/js/scene.js`, with Three.js vendored (see §5).

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
against `--ink` (`#0C1119`) and must reach **≥ 4.5:1**. The dimmest scene colour is `#7A8494`
(5.0:1). There is no dark core, no shadow, and no warm accent in 3D — brass is a DOM-only text
token. This keeps the canvas decorative without ever fighting the copy for contrast.

**Motion contract**

- `prefers-reduced-motion: reduce` → the scene renders **one still frame** at the current scroll
  position and never starts a loop; reveals resolve immediately; smooth scrolling is disabled.
- `navigator.connection.saveData`, a 2G/slow link, or no WebGL → the scene module is **never
  imported**; the DOM falls back to the flat slate canvas.
- The loop is paused when the tab is hidden or the canvas is off-screen, and the scene is
  disposed (geometry, materials, renderer) on teardown. `devicePixelRatio` is capped at 1.6.

---

## 4. Structure

Numbered chapters:

```
01  MANIFEST     hero — stamp, statement, chapter label, live data-source line
02  WORK         featured projects + full filterable repository index
03  SIGNAL       public GitHub activity (real events, real timestamps)
04  ABOUT        short, personal, verified facts only
05  BUILDING     "now building" — only repos that are explicitly unfinished
06  CONTACT      X, Instagram, GitHub, repository index, issue tracker
```

A fixed corner chip tracks `01 / 06 · Name` and a hairline progress bar tracks scroll; the chip
stands down once the footer reaches the viewport so the two never overprint each other. A boot
screen (ASCII mark + status lines) covers the first paint and is removed as soon as the document
is interactive — with JavaScript off it never appears at all.

**Explicitly avoided:** gradients, glassmorphism, glow, oversized rounded cards, dashboard chrome,
animation libraries, placeholder sections, invented metrics.

**Resilience.** `404.html` is a branded not-found page that reuses the same type and palette. The
boot overlay has a wall-clock safety net (`setTimeout` beside the rAF path), so an occluded or
backgrounded tab can never be left behind the overlay.

---

## 5. Content model

Source of truth: `https://api.github.com/users/rahulbag3/repos` (verified live). The curated
overlay adds only *verified* facts — featured ranking, screenshot URLs that return HTTP 200, and
an editorial note derived from each repository's own README. No stars-based ranking: every public
repository has `0` stars, so ranking uses **completeness, code size, recency and README quality**,
which is the honest signal here.

The site's own repository (`rahulbag3.github.io`) is excluded from the listing in `curation.js`
and filtered on every data path, so the page never counts itself as a project.

```
website/
  index.html
  404.html
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

**Social metadata.** Canonical, Open Graph and Twitter URLs are absolute
(`https://rahulbag3.github.io/`), and `assets/og.png` loads from an absolute URL. A `schema.org
Person` block lists GitHub, X and Instagram under `sameAs`; the three profile links carry
`rel="me"`.

---

## 6. Deployment

- GitHub Pages serves the repository root of `rahulbag3/rahulbag3.github.io` from `main`.
- `.nojekyll` is committed so asset paths beginning with `_` are served untouched.
- Pages sends `Cache-Control: max-age=600`; after a deploy, a browser can hold the previous JS for
  up to ten minutes. When verifying a release, re-fetch the exact module URLs with
  `fetch(url, { cache: "reload" })` before judging the page.
- No custom domain. No backend, database, auth, or secrets in client code.

---

## 7. Verification performed

| Check | Result |
|---|---|
| Horizontal overflow, 320 → 1440 px | none (`scrollWidth === clientWidth`) |
| Grid tracks per breakpoint | verified at each width (feature 3→2→1 col, rows 4→1 col, chapter head 2→1 col) |
| All 5 listed repositories rendered from the live API | yes, plus 10 real screenshots |
| Site's own repository excluded on live, cache and snapshot paths | verified with a poisoned six-entry cache; 5 rows |
| Filters (category chip, language select, search) and empty state | pass |
| "Reset filters" button | pass (caught and fixed a real bug: `node.onClick` is not a handler) |
| Mobile menu open / Escape close / `aria-expanded` | pass |
| Anchors resolve, external links carry `rel="noopener"` | pass |
| Images: `alt`, intrinsic `width`/`height`, `loading="lazy"` | 10/10 |
| Every `[data-reveal]` element becomes visible after a full scroll | 43/43, none stuck at `opacity: 0` |
| 3D scene: canvas sized, animates, scroll-mapped, pointer-reactive | confirmed; scene colours all ≥ 4.5:1 vs `--ink` |
| Scene skipped for reduced-motion / `saveData` / no WebGL | renders a single still frame or nothing; DOM unchanged |
| Index chip + scroll progress tracking | 01 → 06, progress 0 → 1 |
| Fallbacks: rate limit `403`, network error, empty payload | all three resolve to the snapshot with the right message |
| Fallback cache: hit, expiry, and behaviour with the network down | pass |
| Unusable/empty events feed | degrades to commit recency and says so |
| Boot overlay dismissal when the tab is occluded | wall-clock safety net verified |
| Contact rows | 5: X, Instagram, GitHub, Repositories, Open issues |
| `schema.org Person` JSON-LD | parses; `sameAs` lists all three profiles |
| Lighthouse accessibility / best-practices / SEO | 100 / 100 / 100 (local and live) |
| Uncaught console errors | none |

The 3D scene is decorative by design: it has no fallback image, because the flat slate canvas is
already the intended look when the layer is skipped.
