# Step 3: Page List and Page Reading — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** The site screen becomes the Pages list (mockup "Pages"). A tap on a page opens it for reading: front matter and Markdown text.

**Architecture:** Two GitHub requests list every Markdown file (branch → tree SHA → recursive tree). Each page's front matter comes from its blob, fetched only when its SHA is not cached. The page list and the blobs are cached in IndexedDB, so a second visit and offline use are fast. A small YAML-subset parser reads the front matter. Pure modules are tested with `node:test`; the screens are checked in a browser with a fake GitHub.

**Spec:** `docs/mvp-plan.md` (sections 5 rules, 6 screen 3, 8 step 3), `docs/design.md` (page type labels), `docs/decisions.md` (21, 22), mockup "Pages" (`Main.dc.html`).

## Global Constraints

- Show only Markdown pages: every `src/**/*.md` except `src/templates/` and `src/skeletons/`. No hand-built HTML pages (mvp-plan section 5).
- Type by path: `src/blog/<slug>/index.md` → Blog, `src/gallery/<slug>/index.md` → Gallery, every other Markdown file → Page (the `skeleton` field does not change the type: `privacy` uses `skeleton: blog` but is a page).
- Draft: `draft: true`, or the string `"true"` in any case (decision 22).
- Dates `YYYY-MM-DD` are UTC (as in `build.js`). Sort: newest first, undated last by title (as `build.js` `sortedPosts`).
- Same rules as step 2: CSP (no inline script or style), 16 px inputs, 44 px targets, STE100 text, token only through `auth.js`.
- No Markdown rendering in this step (see "Decision needed").
- No status bar (step 9) and no "New page" button (step 5) yet.

## Review Focus

1. **Front matter the parser does not know** (block scalars, nested maps, bad YAML) — the page still shows, with its title from the slug and the raw text. The parser never throws. Tests: `frontmatter.test.js`.
2. **A large site** (many pages) — the first load shows progress ("Loading pages: 12 of 50") and limits parallel requests to 6. Later loads fetch only changed blobs. Tests: `pages.test.js` (pool, cache reuse).
3. **Offline or GitHub down** — a cached list shows with "List from <time>"; no cache shows the no-connection message. Test: `pages.test.js`.
4. **Date shown one day early in US time zones** — dates format in UTC. Test: `pages-logic.test.js`.
5. **The v1 IndexedDB of an existing user** — opening the new version adds the two stores and keeps the sites and tokens. Check: browser (the dev browser has a v1 database).

## Tasks

1. `app/js/frontmatter.js` (TDD): `parseFrontmatter(text) → { data, body, raw, error }`, `isDraft(data)`. Scalars (plain, quoted with `:` and `&`, `true`/`false`, numbers, dates as strings, empty → null), a list of maps, a list of scalars, `|` and `>` block scalars, comments, CRLF, BOM. Never throws.
2. `app/js/pages-logic.js` (TDD): `classifyPath(path) → { type, slug } | null`, `sortPages`, `filterPages(pages, { type, query })`, `formatDate`, `pageSummary(path, sha, frontmatterResult)`.
3. `app/js/github.js` (TDD): `listMarkdownFiles({ owner, repo, branch, token, fetch, signal }) → { treeSha, files: [{ path, sha }], truncated }`, `getBlobText({ ..., sha })`.
4. `app/js/db.js` version 2: stores `pageLists` (key `siteId`) and `blobs` (key `sha`). `app/js/pages.js` (TDD with injected fetch and an in-memory store): `loadPages({ site, token, fetch, store, onProgress, signal })` → `{ pages, fetchedAt, fromCache, offline }`, a pool of 6, reuse cached summaries by SHA, skip all blob requests when the tree SHA is unchanged, prune unused blobs.
5. Screens: the site screen becomes the Pages list (header with switcher, site sheet button, theme toggle; title "Pages"; search; chips All/Blog/Pages/Galleries; cards; "List from <time>" with Refresh). Site sheet: repository, template version check, Open on GitHub, Remove this site. Template check failure also shows as a banner on the list. Page view `#/site/<id>/page/<path>`: title, type and date chips, Draft chip, description, front matter table, image list for galleries, Markdown text, Open on GitHub.
6. Service worker ASSETS, then browser check, then whole-branch review.

## User verification (live, on exhibita/gtg-test-site)

- 10 pages: 5 Blog (one with a Draft chip: "Draft check"), 2 Galleries ("4 images", "2 images"), 3 Pages ("Privacy Policy" and "Terms of Service" are Page although they use `skeleton: blog`, and "Test Page").
- Newest first; "Privacy Policy" and "Terms of Service" have no date and are last.
- Open "Test gallery": the caption "Two & more" shows as typed.

## Decision needed (not in this step)

The editor's Write/Preview toggle (step 5) needs a Markdown renderer. Options: a pinned copy of `marked` (the renderer `build.js` uses, MIT) in `app/vendor/`, served from the app itself, or a small own renderer. CLAUDE.md forbids third-party scripts at runtime from other hosts; a copy inside the app is a different case, so the user decides.
