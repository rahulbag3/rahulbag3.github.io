/**
 * app.js — controller.
 *
 * Wires retrieval (data.js) and presentation (render.js) to the document, and owns the
 * interactive behaviour: the boot sequence, the scroll-driven 3D layer, the section
 * corner mark, the mobile menu, project filtering and the entrance reveals. All motion is
 * skipped or reduced under `prefers-reduced-motion: reduce`.
 */

import { loadRepositories, loadActivity, activityFromRepositories, NOW_BUILDING } from "./data.js";
import { CATEGORIES, SECTION_ORDER, IDENTITY } from "./curation.js";
import {
  el,
  featuredProject,
  projectRow,
  activityRow,
  nowCard,
  filterChip,
  stateBlock,
  skeletonRows,
} from "./render.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ *
 * Boot sequence
 *
 * A short, branded loading state. It is dismissed on a timer rather than by a
 * resource callback, so a stalled font or a slow first frame can never leave the
 * reader looking at it forever.
 * ------------------------------------------------------------------ */

const BOOT_MIN_MS = 700;
const BOOT_MAX_MS = 2400;

function runBoot({ onTick } = {}) {
  const boot = $("#boot");
  if (!boot) return;
  const started = performance.now();
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    boot.classList.add("is-done");
    boot.addEventListener("transitionend", () => (boot.hidden = true), { once: true });
    // Belt and braces for the case where transitions are disabled.
    setTimeout(() => (boot.hidden = true), 900);
  };

  const tick = () => {
    if (dismissed) return;
    const elapsed = performance.now() - started;
    if (elapsed >= BOOT_MAX_MS || (elapsed >= BOOT_MIN_MS && (!onTick || onTick()))) {
      dismiss();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // rAF is not serviced while a tab is hidden or its window is occluded, so the loop
  // above cannot be the only way out — otherwise a reader who opens the link in a
  // background tab meets the boot screen when they finally switch to it. Timers are
  // throttled in that situation but still fire, so this lifts the overlay regardless.
  setTimeout(() => dismiss(), BOOT_MAX_MS + 400);
}

/* ------------------------------------------------------------------ *
 * Reusable: anchor scrolling
 * ------------------------------------------------------------------ */

function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior: reduceMotion.matches ? "auto" : "smooth" });
}

function wireAnchorScroll() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return;
    event.preventDefault();
    scrollToId(id);
    history.replaceState(null, "", `#${id}`);
  });
}

/* ------------------------------------------------------------------ *
 * Chrome: progress line, mobile menu, corner mark, active section
 * ------------------------------------------------------------------ */

/** Fraction of the document that has been scrolled past, 0 → 1. */
function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function wireChrome() {
  const bar = $("#progress");
  const topbar = $("#topbar");
  const chipIndex = $("#index-num");
  const chipLabel = $("#index-label");
  const chip = $("#section-index");
  const footer = $(".footer");
  const menuBtn = $("#menu-toggle");
  const menu = $("#menu");
  const navLinks = $$("[data-nav-link]");

  const onScroll = () => {
    bar.style.transform = `scaleX(${scrollProgress()})`;
    topbar.classList.toggle("is-stuck", window.scrollY > 10);

    // Which section owns the viewport right now.
    let current = SECTION_ORDER[0];
    for (const section of SECTION_ORDER) {
      const node = document.getElementById(section.id);
      if (!node) continue;
      if (node.getBoundingClientRect().top - 96 <= 0) current = section;
    }
    if (chipIndex.textContent !== current.num) {
      chipIndex.textContent = current.num;
      chipLabel.textContent = current.label;
    }
    for (const link of navLinks) {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${current.id}`);
    }

    // Stand the corner mark down before the footer arrives: the footer already
    // occupies that corner, and two texts overprinting each other reads as a bug.
    if (chip && footer) {
      chip.classList.toggle("is-off", footer.getBoundingClientRect().top < window.innerHeight - 16);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  const closeMenu = () => {
    menu.dataset.open = "false";
    menuBtn.setAttribute("aria-expanded", "false");
  };
  const openMenu = () => {
    menu.dataset.open = "true";
    menuBtn.setAttribute("aria-expanded", "true");
  };
  menuBtn.addEventListener("click", () => {
    menu.dataset.open === "true" ? closeMenu() : openMenu();
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

/* ------------------------------------------------------------------ *
 * Reveal on scroll
 * ------------------------------------------------------------------ */

function observeReveals(root = document) {
  const targets = $$("[data-reveal]", root);
  if (reduceMotion.matches) {
    targets.forEach((t) => t.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
  );
  targets.forEach((t) => io.observe(t));
}

/** Assign a stagger index so sibling reveals cascade instead of snapping together. */
function stagger(nodes) {
  nodes.forEach((node, i) => node.style.setProperty("--i", String(Math.min(i, 8))));
}

/* ------------------------------------------------------------------ *
 * The 3D layer
 *
 * Loaded last, on its own, and only where it is worth its ~0.7 MB of vendored
 * Three.js: a data-saver connection or a browser without WebGL gets the flat slate
 * canvas instead, at zero cost. A reduced-motion reader still gets the world, but as
 * a single still frame (`animate: false`) that tracks scroll without moving.
 * ------------------------------------------------------------------ */

function webglAvailable() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (probe.getContext("webgl2") || probe.getContext("webgl")));
  } catch {
    return false;
  }
}

function scenePermitted() {
  if (navigator.connection?.saveData) return false;
  const ect = navigator.connection?.effectiveType;
  if (ect === "slow-2g" || ect === "2g") return false;
  return webglAvailable();
}

async function initScene() {
  const canvas = $("#scene");
  if (!canvas) return null;

  const animate = !reduceMotion.matches;
  const { createScene } = await import("./scene.js");
  const scene = createScene({ canvas, animate });

  let queued = false;
  const sync = () => {
    queued = false;
    scene.setProgress(scrollProgress());
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sync);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => scene.resize());

  if (animate) {
    // Pointer parallax, normalised to the viewport and only where a real pointer exists.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.addEventListener(
        "pointermove",
        (event) => {
          scene.setPointer(
            (event.clientX / window.innerWidth) * 2 - 1,
            (event.clientY / window.innerHeight) * 2 - 1,
          );
        },
        { passive: true },
      );
    }

    // Never burn frames on a hidden tab.
    document.addEventListener("visibilitychange", () => {
      document.hidden ? scene.stop() : scene.start();
    });
  }

  new ResizeObserver(() => scene.resize()).observe(canvas);

  scene.resize();
  scene.setProgress(scrollProgress());
  if (animate) scene.start();
  return scene;
}

/* ------------------------------------------------------------------ *
 * Work: featured, listing, filtering
 * ------------------------------------------------------------------ */

function renderFeatured(repos) {
  const host = $("#featured");
  const featured = repos.filter((r) => Number.isFinite(r.curated?.rank)).slice(0, 3);
  const list = featured.length ? featured : repos.slice(0, 3);
  host.replaceChildren(...list.map((repo) => featuredProject(repo)));
  stagger($$(".feature", host));
}

function buildLanguageOptions(repos) {
  const totals = new Map();
  for (const repo of repos) {
    for (const [name, bytes] of Object.entries(repo.languages || {})) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, bytes]) => ({ name, bytes }));
}

function renderListing(repos) {
  const host = $("#project-list");
  const rows = repos.map((repo, i) => projectRow(repo, { index: i }));
  host.replaceChildren(...rows);
  stagger(rows);

  // Category chips
  const chipHost = $("#filters");
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [
      c.id,
      c.id === "all" ? repos.length : repos.filter((r) => (r.categories ?? []).includes(c.id)).length,
    ]),
  );
  chipHost.replaceChildren(
    ...CATEGORIES.map((c) => filterChip({ ...c, count: counts[c.id], active: c.id === "all" })),
  );

  // Language select
  const select = $("#lang-select");
  const options = buildLanguageOptions(repos);
  select.replaceChildren(
    el("option", { value: "all", text: "All languages" }),
    ...options.map((o) => el("option", { value: o.name, text: `${o.name}` })),
  );

  const state = { category: "all", language: "all", query: "" };
  const status = $("#filter-status");
  const emptyHost = $("#filter-empty");

  const apply = () => {
    let shown = 0;
    for (const row of rows) {
      const cats = (row.getAttribute("data-categories") || "").split(",");
      const langs = (row.dataset.languages || "").split(",");
      const okCat = state.category === "all" || cats.includes(state.category);
      const okLang = state.language === "all" || langs.includes(state.language);
      const okQuery = !state.query || (row.dataset.search || "").includes(state.query);
      const visible = okCat && okLang && okQuery;
      row.hidden = !visible;
      if (visible) shown += 1;
    }
    status.textContent = `Showing ${shown} of ${repos.length} repositories`;
    emptyHost.replaceChildren(
      shown === 0
        ? stateBlock("empty", {
            title: "Nothing matches that combination.",
            message: "Try a different language, or clear the search.",
            action: el("button", { className: "btn btn--ghost", type: "button", text: "Reset filters", onClick: reset }),
          })
        : el("span"),
    );
  };

  const reset = () => {
    state.category = "all";
    state.language = "all";
    state.query = "";
    $("#search").value = "";
    select.value = "all";
    for (const chip of $$(".chip", chipHost)) {
      const active = chip.dataset.filter === "all";
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    }
    apply();
  };

  chipHost.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.filter;
    for (const other of $$(".chip", chipHost)) {
      const active = other === chip;
      other.classList.toggle("is-active", active);
      other.setAttribute("aria-pressed", active ? "true" : "false");
    }
    apply();
  });

  select.addEventListener("change", () => {
    state.language = select.value;
    apply();
  });

  $("#search").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    apply();
  });

  apply();
}

/* ------------------------------------------------------------------ *
 * Signal: public activity
 * ------------------------------------------------------------------ */

function renderSignal(items, meta, repos) {
  const host = $("#activity");
  const note = $("#activity-note");
  const stats = $("#signal-stats");

  const source = meta.source === "live" ? items : activityFromRepositories(repos);
  const window30 = source.filter((i) => Date.now() - new Date(i.at).getTime() < 30 * 864e5).length;

  stats.replaceChildren(
    ...[
      [String(repos.length), "public repositories"],
      [String(new Set(source.map((i) => i.repo)).size), "repositories touched"],
      [String(window30), "events in 30 days"],
      [repos[0] ? new Date(repos[0].pushedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—", "last push"],
    ].map(([value, label]) =>
      el(
        "div",
        { className: "stat", dataset: { reveal: "" } },
        el("span", { className: "stat__value", text: value }),
        el("span", { className: "stat__label", text: label }),
      ),
    ),
  );

  note.textContent =
    meta.source === "live"
      ? `Live public events feed · ${items.length} recent entries`
      : "GitHub's events feed is unavailable right now — showing commit recency from repository data instead.";

  const rows = source.slice(0, 12).map((item) => activityRow(item));
  if (!rows.length) {
    host.replaceChildren(
      stateBlock("empty", {
        title: "No public activity to show.",
        message: "The events feed returned nothing, so there is nothing to list here yet.",
      }),
    );
    return;
  }
  host.replaceChildren(...rows);
  stagger(rows);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function boot() {
  // Wait for the webfont so the boot mark is measured in the final typeface, but never
  // longer than the hard cap inside runBoot().
  let fontsReady = false;
  document.fonts?.ready.then(() => (fontsReady = true));
  runBoot({ onTick: () => fontsReady });

  wireAnchorScroll();
  wireChrome();

  const yearHost = $("#year");
  if (yearHost) yearHost.textContent = String(new Date().getFullYear());

  // The 3D layer is decorative and independent of the content, so it is started
  // without blocking the repository fetch.
  if (scenePermitted()) initScene().catch(() => {});

  $("#featured").replaceChildren(skeletonRows(3));
  $("#project-list").replaceChildren(skeletonRows(5));
  $("#activity").replaceChildren(skeletonRows(4));

  const { repositories, meta } = await loadRepositories();

  const label =
    meta.source === "live"
      ? "live · GitHub API"
      : meta.source === "cache"
        ? "recent fetch · GitHub API"
        : meta.source === "snapshot"
          ? "cached snapshot"
          : "unavailable";
  for (const node of $$("#data-source, #data-source-hero")) {
    node.textContent = label;
    node.classList.toggle("is-warn", meta.source === "snapshot" || meta.source === "unavailable");
  }
  if (meta.message) {
    $("#data-note").textContent = meta.message;
    $("#data-note").hidden = false;
  }

  if (!repositories.length) {
    const failure = stateBlock("error", {
      title: "Repositories could not be loaded.",
      message: "The GitHub API was unreachable and no snapshot was available. The profile is still public.",
      action: el(
        "a",
        {
          className: "btn",
          href: IDENTITY.repos,
          attrs: { target: "_blank", rel: "noopener noreferrer" },
        },
        el("span", { text: "Open GitHub" }),
      ),
    });
    $("#featured").replaceChildren(failure);
    $("#project-list").replaceChildren(el("span"));
    return;
  }

  renderFeatured(repositories);
  renderListing(repositories);

  $("#now-list").replaceChildren(...NOW_BUILDING.map(nowCard));
  stagger($$("#now-list .now"));

  const activity = await loadActivity();
  renderSignal(activity.items ?? [], activity.meta, repositories);

  // Observes everything rendered above, including the static HTML.
  observeReveals();
}

document.addEventListener("DOMContentLoaded", boot);
