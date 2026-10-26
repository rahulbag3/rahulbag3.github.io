# rahulbag3 — portfolio

A static personal portfolio and GitHub project showcase. No build step, no framework, no
backend, no analytics. Open `index.html` over any static server and it runs.

Live data comes from GitHub's public REST API. A committed snapshot of the same payload is
used automatically when the API is rate-limited or unreachable, and the page states plainly
which source it is showing.

---

## Run it

```bash
# any static server works
npx serve .
# or
python -m http.server 8080
```

Then open the printed address. It must be served over HTTP(S) rather than `file://`, because
the module scripts are fetched with CORS.

## Deploying

Published with **GitHub Pages** from the `rahulbag3.github.io` repository:

**https://rahulbag3.github.io/** · `main` branch · repository root

There is nothing to build, so a push to `main` *is* the deployment. `.nojekyll` stops Pages
from running the files through Jekyll, and `404.html` is served automatically for unknown
paths.

Social metadata is absolute on that origin, because scrapers (notably X/Twitter) do not resolve
relative paths:

```html
<meta property="og:url" content="https://rahulbag3.github.io/" />
<meta property="og:image" content="https://rahulbag3.github.io/assets/og.png" />
```

Moving to a custom domain means updating those URLs and `<link rel="canonical">`, then adding a
`CNAME` file. Everything else — CSS, scripts, images, the snapshot — uses relative paths and
needs no change.

## Structure

```
index.html                 semantic shell; hero, about and contact copy live here
404.html                   branded not-found page (GitHub Pages serves it automatically)
.nojekyll                  tells GitHub Pages to publish files as-is, no Jekyll pass
README.md                  this file
DESIGN-SPEC.md             the reference analysis and the resulting design decisions
assets/
  css/styles.css           the whole design system
  js/
    data.js                retrieval + normalisation + fallback (no content)
    curation.js            verified editorial overlay (no retrieval)
    render.js              pure DOM builders (no fetching, no global state)
    scene.js               Three.js lattice world: the scroll-driven 3D backdrop
    app.js                 controller: boot, scene lifecycle, nav, filters, reveals
  data/snapshot.js         committed GitHub API snapshot (the fallback)
  vendor/three/            vendored three.module.min.js v0.169.0 + its LICENSE
  favicon.svg              pixel-R monogram (hand-built 5x7 cell font)
  og.png                   1200x630 social card
tools/
  snapshot.mjs             regenerate assets/data/snapshot.js from the live API
  og.html                  source for assets/og.png
```

The separation is deliberate: **retrieval** (`data.js`) never contains copy, **content**
(`curation.js`) never fetches, **presentation** (`render.js`) never touches the network or
global state, and **behaviour** (`app.js` + `scene.js`) wires the three together — with `scene.js`
owning nothing but pixels.

## The data layer

```js
loadRepositories()  // -> { repositories, meta: { source: 'live' | 'snapshot', message } }
loadActivity()      // -> { items, meta }  (best-effort public events feed)
```

1. Check a short-lived `localStorage` cache (30 min for repositories, 10 min for activity).
   This exists because one page load costs 1 + *n* + 1 requests, and unauthenticated GitHub
   allows only 60/hour per IP.
2. Fetch `https://api.github.com/users/rahulbag3/repos` (unauthenticated).
3. Fetch per-repository language byte counts; failures here degrade to the primary language only.
4. On any failure — network, `403`/`429` rate limit, or an empty payload — fall back to
   `assets/data/snapshot.js`, which is verbatim API output.
5. Requests time out after 9 seconds so a hanging request can never stall the page.

The UI always states which source it is showing: *live · GitHub API*, *recent fetch · GitHub API*,
or *cached snapshot*.

The cache only ever stores successful live responses, never the snapshot — the snapshot is
already committed. Private browsing, disabled storage, or a corrupt entry simply falls through
to the network path.

**Nothing is ever fabricated.** There is no placeholder repository data anywhere in the source.
When a repository genuinely has no screenshot in it, the interface says *"No screenshots in the
repository"* rather than showing a mocked-up one. When the events feed is unavailable, the
activity section falls back to commit recency and labels itself as doing so.

Repositories are ranked by completeness, code size, recency and README quality — **not** by
stars, because all five currently have zero.

### Regenerating the snapshot

```bash
node tools/snapshot.mjs
```

Re-run it whenever the repositories change materially. It writes `assets/data/snapshot.js` and
records its own `generatedAt` timestamp.

### About credentials

There are none. The site is public read-only data, so no token is needed and none should be
added: an API token in a static site is in client-side code by definition. 60 requests/hour is
far more than a portfolio needs, and the snapshot covers the case where it is not.

## Accessibility and motion

- Lighthouse: **100 accessibility, 100 best practices, 100 SEO.**
- Semantic landmarks, one `h1`, no heading-level skips, a skip link, and visible focus rings.
- Every image has meaningful `alt`, explicit `width`/`height` (no layout shift) and `loading="lazy"`.
- Filters expose live status via `role="status"`, and chips use `aria-pressed`.
- The 3D backdrop is `aria-hidden` decoration on a fixed canvas behind the content. It is paused
  when the tab is hidden, and under `prefers-reduced-motion: reduce` it paints a single still
  frame that tracks scroll without moving. It is not loaded at all with
  `navigator.connection.saveData`, on a 2G connection, or when WebGL is unavailable — the page is
  complete and identical without it.
- The page is built mobile-first and audited with no horizontal overflow from 320px to 1440px.

## The 3D layer

`assets/js/scene.js` draws a lattice world — a displaced wireframe terrain plus a nested
wireframe solid — on a fixed, full-bleed canvas behind the copy. Document scroll position drives a
table of seven camera/object `STATIONS`, smoothed with smootherstep and then chased by a damped
lerp, so the world reads as a continuous journey rather than a series of jumps.

Three.js **v0.169.0 is vendored** at `assets/vendor/three/` (with its `LICENSE`) and imported with
a dynamic `import()` only when the conditions in *Accessibility and motion* allow. That keeps the
site free of a build step, dependency-free at first paint, and fully usable offline.

Hard rules the scene obeys:

- **Legibility.** Every colour used in WebGL is checked against `--ink` and must reach **≥ 4.5:1**
  contrast. The dimmest scene colour is `#7A8494`. No dark core, no shadows, no warm accent — the
  brass in the palette is a text-only token and never appears in 3D.
- **Weight.** The solid fades with scroll so it is a hero at rest and a quiet ghost behind body
  copy; the terrain keeps constant weight so the ground always reads as continuous landscape.
- **Teardown.** Geometry, materials and the renderer are disposed on teardown, and
  `devicePixelRatio` is capped at 1.6.

## Editing content

- **Prose** (hero, about, contact): edit `index.html`.
- **Project notes, tags, screenshots, featured ranking**: edit `assets/js/curation.js`.
- **Identity constants and the section index**: `curation.js`.

Curated entries are optional. Any repository without one still renders, driven purely by API
data, with a neutral placeholder instead of a screenshot.

## Regenerating the social card

Edit `tools/og.html` and open it over the static server, then screenshot the page with the
viewport/`fullPage` capture and crop to the top **1200×630** px, saving over `assets/og.png`.
The card reuses the site's slate canvas, IBM Plex Mono setting, brass accent marks and pixel
wordmark, so it never drifts from the live design.

## Design

See [`DESIGN-SPEC.md`](./DESIGN-SPEC.md) for the reference analysis (what was observed on the
reference site, what could not be observed, and which principles were carried over) and for the
resulting type scale, palette, 3D legibility contract and motion rules.
