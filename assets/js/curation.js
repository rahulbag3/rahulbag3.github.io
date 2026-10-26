/**
 * curation.js — the editorial layer.
 *
 * This is the ONLY hand-written content in the data path, and it contains nothing
 * that is not verifiable from the repository itself:
 *   - `note`   summarises what the repository's own README states.
 *   - `tags`   are technologies named in the repository's own README/manifests.
 *   - `shots`  are image files that exist in the repository (verified HTTP 200,
 *              with real intrinsic dimensions so the layout never shifts).
 *   - `rank`   orders the featured strip by completeness / code size / recency —
 *              deliberately NOT by stars (every repository here has zero).
 *
 * Anything not listed here falls back to raw repository data in `data.js`.
 * No professional experience, metrics, or achievements are invented anywhere.
 */

const RAW = "https://raw.githubusercontent.com/rahulbag3";

/**
 * Language colours for the distribution bar and the language dots.
 *
 * GitHub's linguist palette is authored for a white background; several of its entries
 * (JavaScript's `#F1E05A`, Shell's `#89E051`) all but disappear on the reference's
 * `#A0A5B1` slate. These are the same hues taken down in lightness until each one reads
 * as a distinct mark on the canvas, keeping the family recognisable.
 */
export const LANGUAGE_COLORS = {
  Kotlin: "#6E3FD1",
  Java: "#8A5A12",
  "C++": "#C22A5A",
  C: "#4A4A4A",
  "C#": "#146B00",
  JavaScript: "#8A7A00",
  TypeScript: "#2A62A0",
  HTML: "#B83A18",
  CSS: "#4B356E",
  Python: "#2C5F8A",
  Shell: "#4E8A1E",
  PowerShell: "#012456",
  CMake: "#B22A2A",
  "Inno Setup": "#1F3E80",
  Batchfile: "#7A9200",
  Swift: "#C43D26",
  Ruby: "#701516",
  Go: "#0A7C99",
  Rust: "#9C6A44",
};

export const FALLBACK_LANGUAGE_COLOR = "#5B6069";

/** Category filter buckets. A repository can belong to more than one. */
export const CATEGORIES = [
  { id: "all", label: "Everything" },
  { id: "android", label: "Android" },
  { id: "windows", label: "Windows" },
  { id: "web", label: "Web" },
];

export const PROJECTS = {
  "agentdeck-android": {
    rank: 1,
    category: ["android"],
    kind: "Android application",
    tags: ["Kotlin", "Android Keystore", "Room", "llama.cpp", "GGUF", "OpenAI-compatible API"],
    note:
      "A control centre for coding agents that runs on the phone. Tasks live in a per-project workspace; a cloud model over your own API key streams replies with Markdown and per-message attribution; an optional host agent runs your own CLI in the real project folder and returns genuine git diffs and check results. A bundled llama.cpp runtime can import a GGUF model and answer offline.",
    facts: [
      "Keys are encrypted with AES-256-GCM under an Android Keystore key; only ciphertext is stored.",
      "Works without a host: execution is then explicitly labelled as simulated.",
      "Tasks, plans, diffs and settings persist in Room across restarts and rotation.",
    ],
    shots: [
      { file: "preview-native/home.png", w: 1080, h: 2400, alt: "AgentDeck home screen listing projects and tasks" },
      { file: "preview-native/task-review.png", w: 1080, h: 2400, alt: "AgentDeck task review with chat, changes and checks tabs" },
      { file: "preview-native/diff.png", w: 1080, h: 2400, alt: "AgentDeck git diff viewer" },
      { file: "preview-native/checks.png", w: 1080, h: 2400, alt: "AgentDeck checks results" },
      { file: "preview-native/settings.png", w: 1080, h: 2400, alt: "AgentDeck settings and model configuration" },
    ],
    shotsBase: `${RAW}/agentdeck-android/agentdeck-root/`,
    shape: "phone",
  },

  "internet-speed-meter": {
    rank: 2,
    category: ["windows"],
    kind: "Windows desktop utility",
    tags: ["WPF", "WebView2", "C#", "Inno Setup", "PowerShell"],
    note:
      "A borderless floating meter that shows live throughput in both directions with a short scrolling history, and runs an on-demand benchmark only when asked. It has no title bar, no background panel and no taskbar button — just a card on the desktop and a tray icon. Ships as a per-user installer and a self-contained portable zip.",
    facts: [
      "Two layouts, expanded and compact, toggled from a pill next to the status line.",
      "Live rates update once a second from OS interface counters and switch to Kbps below 1 Mbps.",
      "The dot grid holds the last twelve seconds of traffic per direction.",
    ],
    shots: [
      { file: "docs/preview.png", w: 648, h: 504, alt: "Internet Speed Meter expanded card" },
      { file: "docs/preview-compact.png", w: 648, h: 504, alt: "Internet Speed Meter compact card" },
    ],
    shotsBase: `${RAW}/internet-speed-meter/main/`,
    shape: "window",
  },

  "syncthing-android-redesign": {
    rank: 3,
    category: ["android"],
    kind: "Android interface redesign",
    tags: ["Java", "Kotlin", "Material 3 Expressive", "MPL-2.0", "Weblate"],
    note:
      "A visual overhaul of the Syncthing-Fork Android app. The synchronisation backend is untouched; the work is the interface — a Material 3 Expressive redesign of the folders, devices and status surfaces, published on its own branch with signed builds attached to releases.",
    facts: [
      "Licensed MPL-2.0, following the upstream Syncthing-Fork licensing.",
      "Distributed as tagged releases and installable through Obtainium.",
      "Largest codebase here by repository size, at roughly 34 MB.",
    ],
    shots: [
      { file: "app/src/main/play/listings/en-US/graphics/phone-screenshots/1-folders.png", w: 1080, h: 2400, alt: "Redesigned folders tab" },
      { file: "app/src/main/play/listings/en-US/graphics/phone-screenshots/2-devices.png", w: 1080, h: 2400, alt: "Redesigned devices tab" },
      { file: "app/src/main/play/listings/en-US/graphics/phone-screenshots/3-status.png", w: 1080, h: 2400, alt: "Redesigned status tab" },
    ],
    shotsBase: `${RAW}/syncthing-android-redesign/redesign/ui-overhaul/`,
    shape: "phone",
  },

  "speed-test": {
    category: ["web"],
    kind: "Web app · design system",
    tags: ["Next.js 16", "React 19", "TypeScript strict", "Tailwind CSS v4", "OKLCH"],
    note:
      "“Velocity” — a Material You inspired internet speed test. The published state is the foundation: a design system, a theme engine and the layout shell. The measurement engine is deliberately not implemented yet, and the README says so plainly.",
    facts: [
      "The theme is generated, not hand-picked: one seed colour → OKLCH → tonal palette → role map.",
      "No component or utility libraries; the design system is built from scratch.",
      "Also billed as Velocity in its own README heading.",
    ],
    info: "Design system only — measurement engine intentionally unimplemented.",
    shape: "abstract",
  },

  LiquidMonitor: {
    category: ["windows"],
    kind: "Windows prototype",
    tags: ["WinUI 3", "Windows App SDK", "C#", "Segoe UI Variable"],
    note:
      "A Windows 11 network and resource monitor prototype with a borderless, rounded, always-on-top-capable floating window. It reports live upload and download rates every 500 ms and offers three code-built themes.",
    facts: [
      "Self-described as a prototype, version 0.1.",
      "Three themes: Liquid Glass, Material 3 Expressive and Frosted Glass.",
      "Runs unpackaged; MSIX packaging is not configured in this version.",
    ],
    info: "Prototype — three theme treatments, no packaging yet.",
    shape: "abstract",
  },
};

/** Repositories that their own README describes as unfinished, in their own words. */
export const NOW_BUILDING = [
  {
    name: "speed-test",
    label: "Velocity",
    state: "Foundation",
    line: "Design system, theme engine and layout shell are in place. The dial and the download/upload phases are the next thing to be built.",
  },
  {
    name: "LiquidMonitor",
    label: "LiquidMonitor",
    state: "Prototype · v0.1",
    line: "Live rates and three theme treatments work. Packaging and the wider resource set are still open.",
  },
];

/**
 * Identity constants. Prose lives in index.html so it is present without JavaScript;
 * only machine-readable facts are kept here.
 */
export const IDENTITY = {
  name: "Rahul",
  handle: "rahulbag3",
  github: "https://github.com/rahulbag3",
  repos: "https://github.com/rahulbag3?tab=repositories",
};

export const SECTION_ORDER = [
  { id: "manifest", num: "01", label: "Manifest" },
  { id: "work", num: "02", label: "Work" },
  { id: "signal", num: "03", label: "Signal" },
  { id: "about", num: "04", label: "About" },
  { id: "prototypes", num: "05", label: "Building" },
  { id: "contact", num: "06", label: "Contact" },
];
