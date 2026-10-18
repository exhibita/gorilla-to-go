# Step 2: App Shell, Add a Site and Token Test — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans). The user opted out of design questions and asked for best judgement, then a test by the user after the build.

**Goal:** An installable, offline-capable PWA shell for Gorilla To Go with the Welcome screen, the Add a site screen with automatic token and site checks, a minimal site screen, theme toggle, and in-app help pages.

**Architecture:** Static files in `app/` (the only folder that is deployed). Vanilla ES modules, hash routing, IndexedDB for sites and tokens, a service worker for offline. Pure modules (`github.js`, `sites-logic.js`, `theme-logic.js`) are tested with `node:test` and an injected `fetch`. IndexedDB and the UI are checked in a browser.

**Tech stack:** HTML, CSS, JavaScript (ES modules). Node 22+ only for the dev server and tests. No runtime dependencies, no build step.

**Spec:** `docs/mvp-plan.md` (sections 1, 2, 4, 6, 8 step 2), `docs/decisions.md`, `docs/design.md`, `docs/github-token.md`, mockups in the Design canvas (Welcome, Add a site, Pages header).

## Global Constraints

- Vanilla HTML, CSS, JS. No framework. No third-party script at runtime (CLAUDE.md).
- Strict CSP as `<meta http-equiv>` (GitHub Pages cannot set headers): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https://api.github.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. So: no inline `<script>`, no `style=""` attributes, no `setAttribute('style')`.
- Sign-in code in one module (`app/js/auth.js`): token storage and the Authorization header live only there.
- Fonts and assets in the app (Outfit for UI, Playfair Display for large titles). Inputs and editor text ≥ 16 px. Touch targets ≥ 44 px.
- App name **Gorilla To Go**, short name **GTG** (decision 14 — wins over the mockup text "Vanilla Gorilla"). Version 0.1.0 (decision 19).
- Token help and upgrade help are pages inside the app and work offline (decision 16 — wins over the mockup link to vg.exhibita.com).
- Add a site checks run automatically after the token is entered (decision 15).
- Required template version: 2 (decisions 8, 9).
- Themes: System / Light / Dark, default System, icon button cycles, saved on the device, applied before first paint, `theme-color` follows (design.md).
- Relative URLs everywhere (`./`), so the app works at a domain root and at a project subpath.
- UI text: ASD STE100 style. Failure strings match `docs/github-token.md`: "Token not accepted", "Repository not found", "No write access".
- Never log a token, never put it in a URL, never store it before the user taps **Add site**.

## Review Focus

1. **A Contents:read-only token** — the user expects "No write access". The repo response's `permissions.push` can show the user's role, not the token's grant, so the write check uses a probe: `POST /repos/{o}/{r}/git/refs` with an all-zero SHA. 422 = write allowed (nothing is created), 403 = no write access. Unit-tested with fake responses; must be verified live by the user (see "User verification").
2. **Repository typed as a URL** (`https://github.com/o/r`, `.git`, trailing slash, spaces) — must parse. Test: `parseRepoInput` cases.
3. **No network / GitHub down** — the user expects a clear message, not a stuck spinner. Test: fetch that throws → "No connection to GitHub".
4. **The same site added twice** — refused with a message. Test: `findDuplicate` is case-insensitive.
5. **Offline after first load** — the shell must open. Test: every file in `app/` is in the service worker precache list; browser check offline reload.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | name, version 0.1.0, `dev` and `test` scripts. No dependencies. |
| `scripts/dev-server.js` | Static server for `app/` (Node built-ins), `Cache-Control: no-store`, correct MIME types. |
| `app/index.html` | Shell: CSP, manifest, icons, `theme-boot.js`, `<main id="app">`, `app.js`. |
| `app/manifest.webmanifest` | Name, icons, `start_url`/`scope` `./`, standalone, colors `#f8f6f2`. |
| `app/sw.js` | Precache `ASSETS` with versioned cache name; cache-first same-origin; never cache other origins. |
| `app/css/app.css` | Font faces, color tokens (light, dark), components. |
| `app/js/theme-boot.js` | Classic script: applies saved theme before first paint. |
| `app/js/version.js` | `export const VERSION = '0.1.0'`. |
| `app/js/theme-logic.js` | Pure: `THEMES`, `nextTheme(t)`, `resolveTheme(t, prefersDark)`, `THEME_COLORS`. |
| `app/js/theme.js` | DOM: read/save theme, apply, toggle button HTML, `theme-color`. |
| `app/js/github.js` | Pure (fetch injected): `parseRepoInput`, `checkSite`, `getTemplateVersion`, `CHECKS`, `REQUIRED_TEMPLATE_VERSION`. |
| `app/js/auth.js` | Sign-in module: `authorizationHeader(token)`, `saveToken`, `getToken`, `deleteToken`. |
| `app/js/db.js` | IndexedDB wrapper: stores `sites` (key `id`) and `tokens` (key `siteId`). |
| `app/js/sites-logic.js` | Pure: `findDuplicate(sites, candidate)`, `defaultName(repo)`. |
| `app/js/sites.js` | `listSites`, `getSite`, `addSite`, `removeSite`, last-site memory. |
| `app/js/dom.js` | `escapeHtml`, `icon(name)` inline SVG strings. |
| `app/js/router.js` | Hash routes → screens. |
| `app/js/app.js` | Boot: theme, router, service worker registration. |
| `app/js/screens/*.js` | `welcome`, `add-site`, `site`, `help-token`, `help-upgrade`. |
| `app/fonts/` | Outfit 400/500/600/700, Playfair Display 700 (latin woff2) + OFL texts. |
| `app/img/` | `logo.png` (small), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`. |
| `test/*.test.js` | `node:test` suites. |

## The checks (`checkSite`)

Run in this order. The first failure stops the run; later checks show as not run.

| id | Pass label | Request | Fail result → message |
|---|---|---|---|
| `token` | Token accepted | `GET /repos/{o}/{r}` | 401 → "Token not accepted" |
| `repo` | Repository found, with write access | same response; then `POST /repos/{o}/{r}/git/refs` `{ref:"refs/heads/gtg-write-check", sha:"0"*40}` | 404 on GET → "Repository not found"; 403/404 on POST → "No write access" (422 = pass) |
| `branch` | Branch `{b}` found | `GET /repos/{o}/{r}/branches/{b}` | 404 → "Branch {b} not found" |
| `template` | Template version {n} (required: 2) | `GET /repos/{o}/{r}/contents/package.json?ref={b}` | 404 or bad JSON → "Not a Vanilla Gorilla site (no package.json)"; no field → version 1; n < 2 → "Template version {n} (required: 2)" + upgrade help link |
| `actions` | Publish status can be read | `GET /repos/{o}/{r}/actions/runs?per_page=1` | 403/404 → "No Actions access" |

Any thrown fetch → "No connection to GitHub". Any other status → "GitHub error {status}". Headers: `Accept: application/vnd.github+json` and `Authorization` from `auth.js`. Path segments are `encodeURIComponent`-ed.

`checkSite({ owner, repo, branch, token, fetch, onUpdate })` returns `{ ok, templateVersion, results }`; `results` is an array of `{ id, label, status: 'waiting'|'running'|'pass'|'fail', message }`. `onUpdate(results)` is called after each change.

## Tasks

### Task 1: Scaffold
`package.json`, `.gitignore`, dev server, `app/index.html`, manifest, fonts (from `npm pack @fontsource/outfit@5.3.0` and `@fontsource/playfair-display@5.3.0`, OFL), icons and small logo (generated from `vanilla-gorilla/src/images/logo.png` with System.Drawing), `version.js`, `css/app.css` tokens. Tests (`test/shell.test.js`): VERSION equals package.json version; manifest name/short_name/start_url/scope/colors; CSP meta present with `connect-src https://api.github.com`; no `style="` and no inline `<script>` in `app/` HTML/JS.

### Task 2: `github.js` (TDD)
Tests (`test/github.test.js`): `parseRepoInput` (owner/repo; https URL; `.git`; trailing slash; spaces; `www.`; empty/invalid → null); `checkSite` happy path (all pass, version 2); each failure row above; network error; later rows stay `waiting` after a failure; `onUpdate` called; token never appears in any requested URL; `getTemplateVersion` (base64 with newlines, UTF-8, missing field → 1).

### Task 3: storage and sign-in
`db.js`, `auth.js`, `sites-logic.js` (TDD: `findDuplicate` case-insensitive owner/repo, exact branch; `defaultName`), `sites.js`. IndexedDB verified in the browser.

### Task 4: shell
`theme-logic.js` (TDD: cycle system→light→dark→system; resolve), `theme-boot.js`, `theme.js`, `dom.js`, `router.js`, `app.js`, Welcome screen (logo, "Gorilla To Go", "Manage your sites from your phone.", version chip, "To start, you need:" list, **Add a site**, "How to create a GitHub token" → `#/help/token`, "Your token stays on this device."), help pages (token from `docs/github-token.md`; upgrade from `vanilla-gorilla/docs/UPGRADE-v2.md`, short).

### Task 5: Add a site and site screens
Add a site (mockup layout): repository, branch (default `main`), name in the app (default = repo name), token (password + show + Paste), "How to create a token" → help. Checks card auto-runs 600 ms after the last change when repo parses, branch and token are not empty; a newer run cancels an older one. **Add site** enabled only when all pass; duplicate refused. Saves site, then token (auth.js), remembers it as last site, opens `#/site/{id}`.
Site screen: header (site switcher button → bottom sheet with sites and "Add a site"; theme toggle), title = site name, `owner/repo · branch`, template version re-check on open, note "The page list comes in the next version.", **Remove this site** → confirmation sheet → deletes site and token.
`#/` opens the last site, else the first site, else Welcome.

### Task 6: service worker
`sw.js` with `ASSETS` list and `CACHE = 'gtg-' + version`. Test: every file under `app/` (except `sw.js`) is in `ASSETS`, and every entry exists. Registration in `app.js` (`./sw.js`).

### Task 7: verification
`npm test`; browser check at 375 px light and dark: Welcome, theme cycle, help pages, Add a site with a bogus token → "Token not accepted", Add disabled, offline reload. Then a whole-branch review.

## User verification (needs a real token — the user does this)

1. Add `exhibita/gtg-test-site` with a correct token → all 5 checks pass → site screen.
2. Make a second token with Contents **Read-only** → the write check must say "No write access". If it passes instead, tell Claude: the probe needs a change.
3. A token without Actions permission → "No Actions access".
4. Phone test: `npm run dev`, then `ngrok http 5173`, open the HTTPS URL, Add to Home Screen.

Deployment to gtg.exhibita.com is not in this step: the repository is private, so GitHub Pages needs a decision (public repo or paid plan, and DNS).
