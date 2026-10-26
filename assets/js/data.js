/**
 * data.js — retrieval and normalisation.
 *
 * Responsibilities, and only these:
 *   1. Ask GitHub's public REST API for the user's public repositories.
 *   2. Normalise the payload into the shape the site renders.
 *   3. Fall back to the committed snapshot (assets/data/snapshot.js) when the live
 *      request fails, is rate-limited, or returns nothing usable.
 *   4. Attach the verified editorial overlay from curation.js.
 *
 * No secrets, no token, no backend. Unauthenticated GitHub API allows 60 requests/hour
 * per IP, which is why a snapshot exists and why failures degrade rather than blank out.
 */

import { SNAPSHOT } from "../data/snapshot.js";
import { PROJECTS, NOW_BUILDING } from "./curation.js";

const API = "https://api.github.com";
const USER = "rahulbag3";
const REQUEST_TIMEOUT = 9000;

/* ------------------------------------------------------------------ *
 * Cache
 *
 * Each page load costs 1 request for the repository list, 1 per repository for
 * language byte counts, and 1 for the events feed. Unauthenticated GitHub allows 60
 * requests/hour per IP, so a short cache keeps a normal browsing session comfortably
 * inside the limit. Only successful live responses are cached; the snapshot never is,
 * because it is already on disk.
 * ------------------------------------------------------------------ */

const REPOS_TTL = 30 * 60 * 1000;
const ACTIVITY_TTL = 10 * 60 * 1000;
const CACHE_PREFIX = "rahulbag3.portfolio.v1.";

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > ttl) return null;
    return parsed.value;
  } catch {
    return null; // private mode, disabled storage, or corrupt entry
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* storage unavailable — the network path still works */
  }
}


/** fetch with a hard timeout so a hanging request cannot stall the page. */
async function getJSON(url, signal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      const err = new Error(`GitHub API responded ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Map one API repository object onto our render shape. */
function normaliseRepo(raw) {
  return {
    name: raw.name,
    description: raw.description || null,
    language: raw.language || null,
    languages: raw.languages || {},
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    size: raw.size ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    homepage: raw.homepage || null,
    license: raw.license?.spdx_id || null,
    fork: Boolean(raw.fork),
    archived: Boolean(raw.archived),
    hasPages: Boolean(raw.has_pages),
    defaultBranch: raw.default_branch || "main",
    url: raw.html_url,
  };
}

/** Attach the verified editorial overlay. Missing entries stay purely data-driven. */
export function decorate(repo) {
  const c = PROJECTS[repo.name];
  if (!c) return { ...repo, curated: null };
  return {
    ...repo,
    curated: {
      rank: c.rank ?? Number.POSITIVE_INFINITY,
      kind: c.kind ?? null,
      tags: c.tags ?? [],
      note: c.note ?? null,
      facts: c.facts ?? [],
      info: c.info ?? null,
      shape: c.shape ?? "abstract",
      category: c.category ?? [],
      shots: (c.shots ?? []).map((s) => ({
        src: `${c.shotsBase}${s.file}`,
        w: s.w,
        h: s.h,
        alt: s.alt,
      })),
    },
    // Primary language is API truth; category is editorial.
    categories: c.category ?? [],
    kind: c.kind ?? "Repository",
    published: c.kind ?? "Repository",
  };
}

/** Ordered, decorated repository list: featured first, then most recently pushed. */
export function order(repos) {
  return [...repos].sort((a, b) => {
    const ra = a.curated?.rank ?? Number.POSITIVE_INFINITY;
    const rb = b.curated?.rank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return new Date(b.pushedAt) - new Date(a.pushedAt);
  });
}

/** Top-N language split with proportional widths, for the distribution bar. */
export function languageSplit(languages, limit = 4) {
  const entries = Object.entries(languages || {});
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (!total) return [];
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, bytes]) => ({ name, pct: (bytes / total) * 100 }));
}

/** Human relative time from an ISO string. Deterministic given `now`. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const s = Math.max(1, Math.round((now - then) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [label, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${label}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ *
 * Public entry points
 * ------------------------------------------------------------------ */

/** Load public repositories: cache, then live API, then the committed snapshot. */
export async function loadRepositories({ signal } = {}) {
  const cached = readCache("repos", REPOS_TTL);
  if (cached) {
    return {
      repositories: order(cached.repositories.map(decorate)),
      user: cached.user,
      meta: { source: "cache", fetchedAt: new Date(cached.at).toISOString(), message: null },
    };
  }

  try {
    const raw = await getJSON(
      `${API}/users/${USER}/repos?per_page=100&sort=updated&type=public`,
      signal,
    );
    const usable = Array.isArray(raw) ? raw.filter((r) => !r.fork && !r.archived) : [];
    if (!usable.length) throw new Error("GitHub API returned no usable repositories");

    // Language byte counts are a second endpoint per repository. They are a nicety,
    // so failures here degrade to the primary language instead of failing the load.
    const languages = await Promise.allSettled(
      usable.map((r) =>
        getJSON(`${API}/repos/${USER}/${r.name}/languages`, signal),
      ),
    );
    usable.forEach((r, i) => {
      const result = languages[i];
      r.languages = result.status === "fulfilled" ? result.value : {};
    });

    const normalised = usable.map(normaliseRepo);
    writeCache("repos", { at: Date.now(), repositories: normalised, user: SNAPSHOT.user });

    return {
      repositories: order(normalised.map(decorate)),
      user: SNAPSHOT.user,
      meta: { source: "live", fetchedAt: new Date().toISOString(), message: null },
    };
  } catch (error) {
    if (error?.name === "AbortError" && signal?.aborted) {
      return { repositories: [], meta: { source: "aborted", fetchedAt: null, message: null } };
    }
    const rateLimited = error?.status === 403 || error?.status === 429;
    return {
      repositories: order(SNAPSHOT.repositories.map(decorate)),
      user: SNAPSHOT.user,
      meta: {
        source: "snapshot",
        fetchedAt: SNAPSHOT.generatedAt,
        message: rateLimited
          ? "GitHub's anonymous API limit is in effect, so this is the committed snapshot."
          : "GitHub could not be reached, so this is the committed snapshot.",
      },
    };
  }
}

/**
 * Public activity. GitHub's events feed is short-lived and undocumented for third parties,
 * so this is best-effort: on failure the caller falls back to commit recency computed from
 * the repository data it already has.
 */
export async function loadActivity({ signal } = {}) {
  const cached = readCache("activity", ACTIVITY_TTL);
  if (Array.isArray(cached) && cached.length) {
    return { items: cached, meta: { source: "live", cached: true } };
  }

  try {
    const raw = await getJSON(`${API}/users/${USER}/events/public?per_page=100`, signal);
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty events feed");
    const items = raw
      .map((e) => ({
        type: e.type,
        repo: e.repo?.name ?? null,
        at: e.created_at,
        commits: e.payload?.size ?? null,
        detail: e.payload?.ref_type ?? e.payload?.action ?? null,
        ref: (e.payload?.ref ?? "").replace("refs/heads/", "") || null,
        title:
          e.type === "PushEvent"
            ? (e.payload?.commits?.[0]?.message ?? "").split("\n")[0]
            : null,
      }))
      .filter((e) => e.repo && e.at);
    if (!items.length) throw new Error("no usable events");
    writeCache("activity", items);
    return { items, meta: { source: "live", cached: false } };
  } catch {
    return { items: null, meta: { source: "unavailable" } };
  }
}

/** Recency fallback for the activity section, derived from repository push timestamps. */
export function activityFromRepositories(repos) {
  return repos
    .slice()
    .sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt))
    .map((r) => ({
      type: "PushEvent",
      repo: `${USER}/${r.name}`,
      at: r.pushedAt,
      commits: null,
      detail: null,
      ref: r.defaultBranch,
      title: null,
    }));
}

export { NOW_BUILDING };
