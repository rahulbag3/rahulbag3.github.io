/**
 * render.js — presentation only.
 *
 * Pure builders that turn normalised repository data into DOM. No fetching, no global
 * state, no side effects, and no use of innerHTML for anything derived from the API:
 * every dynamic string goes through textContent, so repository text cannot inject markup.
 */

import { LANGUAGE_COLORS, FALLBACK_LANGUAGE_COLOR } from "./curation.js";
import { languageSplit, relativeTime, formatDate } from "./data.js";

/* ------------------------------------------------------------------ *
 * Tiny element factory
 * ------------------------------------------------------------------ */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  const { className, text, attrs, dataset, style, ...rest } = props;
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  if (style) Object.assign(node.style, style);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  if (dataset) for (const [k, v] of Object.entries(dataset)) if (v != null) node.dataset[k] = String(v);
  for (const [k, v] of Object.entries(rest)) {
    if (v == null) continue;
    // `onClick: fn` -> addEventListener('click', fn). Assigning `node.onClick` would
    // silently do nothing, because the DOM property is lowercase `onclick`.
    if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
      continue;
    }
    node[k] = v;
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(pathData, { size = 16, fill = "none", stroke = "currentColor", strokeWidth = 1.6 } = {}) {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("fill", fill);
  s.setAttribute("stroke", stroke);
  s.setAttribute("stroke-width", strokeWidth);
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", pathData);
  s.append(p);
  return s;
}

export const ICONS = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2",
  dot: "M12 12h.01",
  alert: "M12 8v5M12 16.5h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
};

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function langColor(name) {
  return LANGUAGE_COLORS[name] || FALLBACK_LANGUAGE_COLOR;
}

export function langDot(name) {
  return el("span", {
    className: "lang-dot",
    attrs: { "aria-hidden": "true", style: `background:${langColor(name)}` },
  });
}

export function langBar(languages, { max = 4 } = {}) {
  const split = languageSplit(languages, max);
  if (!split.length) return el("div", { className: "langbar langbar--empty" });
  const bar = el("div", {
    className: "langbar",
    attrs: { role: "img", "aria-label": `Language mix: ${split.map((s) => `${s.name} ${s.pct.toFixed(0)}%`).join(", ")}` },
  });
  for (const seg of split) {
    bar.append(
      el("span", {
        className: "langbar__seg",
        attrs: { style: `flex:${seg.pct} 1 0;background:${langColor(seg.name)}` },
      }),
    );
  }
  return bar;
}

export function linkArrow(href, label, { external = true, className = "text-link" } = {}) {
  return el(
    "a",
    {
      className,
      href,
      attrs: {
        ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
      },
    },
    el("span", { text: label }),
    external ? svg(ICONS.external, { size: 13 }) : svg(ICONS.arrow, { size: 13 }),
  );
}

/** States: loading / error / empty. Always rendered rather than leaving a blank region. */
export function stateBlock(kind, { title, message, action } = {}) {
  const wrap = el("div", { className: `state state--${kind}`, attrs: { role: kind === "error" ? "alert" : "status" } });
  wrap.append(el("span", { className: "state__glyph", text: kind === "loading" ? "◌" : kind === "error" ? "!" : "—" }));
  wrap.append(el("p", { className: "state__title", text: title }));
  if (message) wrap.append(el("p", { className: "state__msg", text: message }));
  if (action) wrap.append(action);
  return wrap;
}

export function skeletonRows(n = 5) {
  const wrap = el("div", { className: "skeleton", attrs: { "aria-hidden": "true" } });
  for (let i = 0; i < n; i++) {
    wrap.append(
      el(
        "div",
        { className: "skeleton__row", style: { animationDelay: `${i * 90}ms` } },
        el("span", { className: "skeleton__bar", style: { width: `${34 + ((i * 7) % 20)}%` } }),
        el("span", { className: "skeleton__bar skeleton__bar--dim", style: { width: `${52 + ((i * 11) % 26)}%` } }),
      ),
    );
  }
  return wrap;
}

/* ------------------------------------------------------------------ *
 * Project pieces
 * ------------------------------------------------------------------ */

function shotFrame(shot, shape) {
  return el(
    "figure",
    { className: `shot shot--${shape}` },
    el("img", {
      className: "shot__img",
      attrs: {
        src: shot.src,
        alt: shot.alt || "",
        width: shot.w,
        height: shot.h,
        loading: "lazy",
        decoding: "async",
      },
    }),
  );
}

function shotStrip(repo) {
  const shots = repo.curated?.shots ?? [];
  if (!shots.length) {
    // No verified screenshot exists for this repository. Say so rather than mock one up.
    return el(
      "div",
      { className: "shot-none", attrs: { "aria-hidden": "false" } },
      el("span", { className: "shot-none__glyph" }, el("span", { text: repo.language || "repo" })),
      el("span", { className: "shot-none__note", text: "No screenshots in the repository" }),
    );
  }
  const shape = repo.curated?.shape === "window" ? "window" : "phone";
  const strip = el("div", {
    className: `shots shots--${shape}`,
    attrs: { tabindex: shots.length > 1 ? "0" : null, role: "group", "aria-label": `${repo.name} screenshots` },
  });
  for (const shot of shots) strip.append(shotFrame(shot, shape));
  return strip;
}

function metaRow(repo, now) {
  const items = [];
  if (repo.language) {
    items.push(
      el("span", { className: "meta__item" }, langDot(repo.language), el("span", { text: repo.language })),
    );
  }
  items.push(el("span", { className: "meta__item", text: `updated ${relativeTime(repo.pushedAt, now)}` }));
  if (repo.license) items.push(el("span", { className: "meta__item", text: repo.license }));
  if (repo.stars) items.push(el("span", { className: "meta__item", text: `★ ${repo.stars}` }));
  return el("div", { className: "meta" }, items);
}

/** Featured project — a full-width editorial chapter. */
export function featuredProject(repo, { now = Date.now() } = {}) {
  const c = repo.curated ?? {};
  const rank = c.rank && Number.isFinite(c.rank) ? String(c.rank).padStart(2, "0") : "··";
  const tags = (c.tags ?? []).slice(0, 6);

  return el(
    "article",
    { className: "feature", dataset: { reveal: "" } },
    el(
      "div",
      { className: "feature__aside" },
      el("span", { className: "feature__rank", text: rank }),
      el("span", { className: "feature__kind", text: c.kind ?? "Repository" }),
      el("div", { className: "feature__bar" }, langBar(repo.languages)),
      metaRow(repo, now),
    ),
    el(
      "div",
      { className: "feature__body" },
      el("h3", { className: "feature__title" }, el("a", { href: repo.url, attrs: { target: "_blank", rel: "noopener noreferrer" }, text: repo.name })),
      c.note ? el("p", { className: "feature__note", text: c.note }) : repo.description ? el("p", { className: "feature__note", text: repo.description }) : null,
      c.facts?.length
        ? el(
            "ul",
            { className: "factlist" },
            c.facts.map((f) => el("li", { className: "factlist__item", text: f })),
          )
        : null,
      tags.length
        ? el("ul", { className: "taglist" }, tags.map((t) => el("li", { className: "tag", text: t })))
        : null,
      el(
        "div",
        { className: "feature__actions" },
        linkArrow(repo.url, "Open repository"),
        repo.homepage ? linkArrow(repo.homepage, "Live site") : null,
      ),
    ),
    el("div", { className: "feature__media" }, shotStrip(repo)),
  );
}

/** Full-listing row. Reads as a spec-sheet entry on desktop, a card on mobile. */
export function projectRow(repo, { now = Date.now(), index = 0 } = {}) {
  const c = repo.curated ?? {};
  const desc = repo.description || c.note || "No description in the repository.";
  const updated = el("time", { className: "row__updated", attrs: { datetime: repo.pushedAt }, text: relativeTime(repo.pushedAt, now) });

  return el(
    "article",
    {
      className: "row",
      dataset: {
        reveal: "",
        index: String(index),
        languages: (repo.languages ? Object.keys(repo.languages) : []).join(","),
        search: `${repo.name} ${desc} ${c.kind ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase(),
      },
      attrs: { "data-categories": (repo.categories ?? []).join(",") },
    },
    // One wrapping link keeps the whole row clickable while text stays selectable.
    el(
      "a",
      {
        className: "row__link",
        href: repo.url,
        attrs: { target: "_blank", rel: "noopener noreferrer" },
      },
      el(
        "div",
        { className: "row__head" },
        el("h3", { className: "row__name", text: repo.name }),
        el("span", { className: "row__kind", text: c.kind ?? "Repository" }),
      ),
      el("p", { className: "row__desc", text: desc }),
      el(
        "div",
        { className: "row__foot" },
        el(
          "span",
          { className: "row__lang" },
          repo.language ? langDot(repo.language) : null,
          el("span", { text: repo.language || "—" }),
        ),
        el("span", { className: "row__sep", attrs: { "aria-hidden": "true" } }),
        updated,
        repo.size
          ? el("span", { className: "row__size", text: `${(repo.size / 1024).toFixed(1)} MB` })
          : null,
        repo.openIssues
          ? el("span", { className: "row__issues", text: `${repo.openIssues} open` })
          : null,
      ),
      el("div", { className: "row__langbar" }, langBar(repo.languages, { max: 3 })),
      el("span", { className: "row__go", attrs: { "aria-hidden": "true" } }, svg(ICONS.arrow, { size: 18 })),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * Other sections
 * ------------------------------------------------------------------ */

export function activityRow(item, { now = Date.now() } = {}) {
  const verb = {
    PushEvent: "push",
    CreateEvent: "create",
    DeleteEvent: "delete",
    ReleaseEvent: "release",
    PublicEvent: "publicise",
    PullRequestEvent: "pull request",
    IssuesEvent: "issue",
    IssueCommentEvent: "comment",
    ForkEvent: "fork",
    WatchEvent: "star",
  }[item.type] || item.type.replace(/Event$/, "").toLowerCase();

  const time = el("time", {
    className: "log__time",
    attrs: { datetime: item.at, title: formatDate(item.at) },
    text: relativeTime(item.at, now),
  });

  return el(
    "li",
    { className: "log__row", dataset: { reveal: "" } },
    time,
    el("span", { className: `log__verb log__verb--${verb.split(" ")[0]}`, text: verb }),
    el(
      "span",
      { className: "log__repo" },
      el("span", { className: "log__owner", text: `${item.repo.split("/")[0]}/` }),
      el("span", { className: "log__name", text: item.repo.split("/")[1] }),
    ),
    item.ref ? el("span", { className: "log__ref", text: item.ref }) : null,
    item.commits ? el("span", { className: "log__count", text: `${item.commits} commit${item.commits === 1 ? "" : "s"}` }) : null,
    item.title ? el("span", { className: "log__title", text: item.title }) : null,
  );
}

export function nowCard(item) {
  return el(
    "article",
    { className: "now", dataset: { reveal: "" } },
    el(
      "div",
      { className: "now__top" },
      el("h3", { className: "now__title", text: item.label }),
      el("span", { className: "badge", text: item.state }),
    ),
    el("p", { className: "now__line", text: item.line }),
    el(
      "a",
      {
        className: "now__link",
        href: `https://github.com/rahulbag3/${item.name}`,
        attrs: { target: "_blank", rel: "noopener noreferrer" },
      },
      el("span", { text: item.name }),
      svg(ICONS.arrow, { size: 14 }),
    ),
  );
}

export function filterChip({ id, label, count, active }) {
  return el("button", {
    className: `chip${active ? " is-active" : ""}`,
    type: "button",
    dataset: { filter: id },
    attrs: { "aria-pressed": active ? "true" : "false" },
    role: undefined,
  }, el("span", { text: label }), count != null ? el("span", { className: "chip__count", text: String(count) }) : null);
}
