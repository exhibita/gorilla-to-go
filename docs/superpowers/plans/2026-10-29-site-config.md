# Site Address, Title and Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The site sheet edits `siteUrl`, `siteTitle` and `siteDescription` in the site's `config.json`, and warns when the site uses the template's address.

**Architecture:** A pure module (`site-config.js`) reads, checks and changes the JSON text. A new `getFileText()` in `github.js` reads the file. The existing `saveFile()` commits it with the file SHA, so a file that changed on GitHub gives the usual conflict. The site sheet reads `config.json` only when the user opens the sheet (the user wants as few requests as possible), so there is no new route and no banner on the Pages screen.

**Tech Stack:** Vanilla ES modules, GitHub REST contents API, `node --test` with a fake `fetch` and jsdom.

**Spec:** GitHub issue [#38](https://github.com/exhibita/gorilla-to-go/issues/38), changed by the user on 2026-10-29: the fields and the warning go in the site sheet, not on a separate screen or the Pages screen.

## Global Constraints

- No framework, no third-party scripts, no change to the CSP.
- The token goes only through `auth.js`, as in `github.js` `request()`.
- GTG changes only `siteUrl`, `siteTitle` and `siteDescription`. All other keys (for example `distributionId`, `awsProfile`, `rssItemLimit`) and their order stay the same.
- A new `config.json` starts with this key, exactly: `"_comment": "WARNING: Do NOT put secrets (passwords, API keys, tokens, access keys) in this file. It is committed to the GitHub repository."`
- Template address: `https://exhibita.github.io/vanilla-gorilla`. Template repository: `exhibita/vanilla-gorilla` (compare without case).
- Commit message: `Update site settings with Gorilla To Go` (same style as `Delete <slug> with Gorilla To Go`).
- No request for `config.json` until the user opens the site sheet. At most one read for each visit to the site screen, plus a read again after a conflict.
- Every new file in `app/` goes into `ASSETS` in `sw.js` (`test/service-worker.test.js` checks this).
- User text in the spirit of ASD STE100. Inputs at least 16 px. Touch targets 44 px.
- Release: version `0.17.0` in `package.json`, `app/js/version.js` and `sw.js` `VERSION`; a `CHANGELOG.md` entry; then `npm run changelog`.

## Review Focus

1. **`config.json` is not valid JSON** (a hand edit broke it). GTG shows an error and disables Save. It never overwrites the file. Test in Task 1 (`parseSiteConfig`) and Task 3 (view with `error`).
2. **The file has 4-space indentation or no newline at the end.** GTG keeps both, so the diff shows only the changed lines. Test in Task 1.
3. **The file has only `distributionId` and `awsProfile`.** The three keys go after them, and `_comment` is not added. Test in Task 1.
4. **The user types `example.com` or `https://example.com/ `.** The first is refused with a message (GTG does not add `https://`, as in decision 30). The second is saved as `https://example.com`. Test in Task 1.
5. **Offline when the sheet opens.** The sheet shows "Not read: no connection to GitHub", the fields are disabled, and the rest of the sheet works. Test in Task 3 (view with `offline`).

---

### Task 1: `site-config.js` logic

**Files:**
- Create: `app/js/site-config.js`
- Create: `test/site-config.test.js`
- Modify: `app/sw.js` (add `js/site-config.js` to `ASSETS`)

**Interfaces:**
- Produces:
  - `TEMPLATE_SITE_URL = 'https://exhibita.github.io/vanilla-gorilla'`
  - `parseSiteConfig(text: string | null) -> { ok: true, config: object } | { ok: false, error: string }`. `null` (no file) gives `{ ok: true, config: {} }`. Text that is not a JSON object gives `ok: false` with `error: 'config.json is not valid JSON. Correct it on GitHub first.'`
  - `checkSiteValues({ siteUrl, siteTitle, siteDescription }) -> { values, errors }`. `values` has trimmed strings, and `siteUrl` without trailing `/` characters. `errors` has `siteUrl` and/or `siteTitle` keys with the message to show. No errors gives `{}`.
  - `applySiteConfig(text: string | null, values) -> string`. The new file text.
  - `needsAddressWarning(config: object, { owner, repo }) -> boolean`

- [ ] **Step 1: Write the failing tests** in `test/site-config.test.js`:

```js
const FILE = '{\n  "_comment": "x",\n  "siteUrl": "https://exhibita.github.io/vanilla-gorilla",\n  "siteTitle": "Vanilla Gorilla",\n  "siteDescription": "d",\n  "distributionId": "E1",\n  "awsProfile": "p"\n}\n';
const VALUES = { siteUrl: 'https://ex.com', siteTitle: 'Ex', siteDescription: 'About ex' };

test('applySiteConfig changes only the three keys and keeps the order of all keys', () => {
    const out = applySiteConfig(FILE, VALUES);
    assert.deepEqual(Object.keys(JSON.parse(out)), ['_comment', 'siteUrl', 'siteTitle', 'siteDescription', 'distributionId', 'awsProfile']);
    assert.equal(JSON.parse(out).distributionId, 'E1');
    assert.equal(JSON.parse(out).siteUrl, 'https://ex.com');
});
test('applySiteConfig keeps 4-space indentation and a missing final newline', () => {
    const four = JSON.stringify({ a: 1, siteUrl: 'x' }, null, 4);
    const out = applySiteConfig(four, VALUES);
    assert.match(out, /^\{\n {4}"a": 1,/);
    assert.ok(!out.endsWith('\n'));
    assert.ok(applySiteConfig(FILE, VALUES).endsWith('}\n'));
});
test('a file without the three keys gets them after its keys, and no _comment', () => {
    const out = JSON.parse(applySiteConfig('{"distributionId":"E1","awsProfile":"p"}', VALUES));
    assert.deepEqual(Object.keys(out), ['distributionId', 'awsProfile', 'siteUrl', 'siteTitle', 'siteDescription']);
});
test('no file gives a new file with the warning _comment first, 2 spaces and a final newline', () => {
    const out = applySiteConfig(null, VALUES);
    assert.deepEqual(Object.keys(JSON.parse(out)), ['_comment', 'siteUrl', 'siteTitle', 'siteDescription']);
    assert.match(JSON.parse(out)._comment, /^WARNING: Do NOT put secrets/);
    assert.match(out, /^\{\n {2}"_comment"/);
    assert.ok(out.endsWith('}\n'));
});
test('parseSiteConfig refuses text that is not a JSON object', () => {
    for (const bad of ['{ "a": ', '[]', '"x"', 'null']) assert.equal(parseSiteConfig(bad).ok, false);
    assert.deepEqual(parseSiteConfig(null), { ok: true, config: {} });
});
test('checkSiteValues trims, removes trailing slashes and requires an http(s) address and a title', () => {
    assert.deepEqual(checkSiteValues({ siteUrl: ' https://ex.com// ', siteTitle: ' Ex ', siteDescription: '' }),
        { values: { siteUrl: 'https://ex.com', siteTitle: 'Ex', siteDescription: '' }, errors: {} });
    assert.ok(checkSiteValues({ ...VALUES, siteUrl: 'ex.com' }).errors.siteUrl);
    assert.ok(checkSiteValues({ ...VALUES, siteUrl: 'ftp://ex.com' }).errors.siteUrl);
    assert.ok(checkSiteValues({ ...VALUES, siteTitle: '  ' }).errors.siteTitle);
    assert.equal(checkSiteValues({ ...VALUES, siteDescription: '' }).errors.siteDescription, undefined);
});
test('needsAddressWarning: missing or template address, but never for the template repository', () => {
    const site = { owner: 'me', repo: 'blog' };
    assert.equal(needsAddressWarning({}, site), true);
    assert.equal(needsAddressWarning({ siteUrl: TEMPLATE_SITE_URL }, site), true);
    assert.equal(needsAddressWarning({ siteUrl: `${TEMPLATE_SITE_URL}/` }, site), true);
    assert.equal(needsAddressWarning({ siteUrl: 'https://ex.com' }, site), false);
    assert.equal(needsAddressWarning({}, { owner: 'Exhibita', repo: 'Vanilla-Gorilla' }), false);
});
```

- [ ] **Step 2: Run the tests.** Run: `node --test test/site-config.test.js`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `app/js/site-config.js`.** Use `JSON.parse`, set the three keys on the parsed object (existing keys keep their place, new keys go at the end), then `JSON.stringify(config, null, indent)`. Find `indent` from the first indented line of the old text (`/\n([ \t]+)"/`); use 2 spaces when there is none. Add `\n` at the end when the old text ended with `\n`, or when there was no file. Error messages: `siteUrl` → `Type the full address, with https://.`; `siteTitle` → `Type a title.`

- [ ] **Step 4: Add `'js/site-config.js'` to `ASSETS` in `app/sw.js`** (alphabetical order).

- [ ] **Step 5: Run all tests.** Run: `npm test`. Expected: all PASS.

- [ ] **Step 6: Commit.**

```bash
git add app/js/site-config.js test/site-config.test.js app/sw.js
git commit -m "feat: read and change the site keys of config.json (#38)"
```

### Task 2: `getFileText()` in `github.js`

**Files:**
- Modify: `app/js/github.js` (near `saveFile`, line 278)
- Test: `test/github.test.js`

**Interfaces:**
- Produces: `getFileText({ owner, repo, branch, path, token, fetch, signal, timeoutMs }) -> Promise<{ sha: string, text: string } | null>`. `null` when GitHub answers 404. Throws `GitHubError('No connection to GitHub', { offline: true })` with no answer, and `GitHubError('Token not accepted')` on 401 (through `getJson`).

- [ ] **Step 1: Write the failing tests** in `test/github.test.js` with the existing `fakeFetch`:
  - `getFileText reads a file as UTF-8 text with its SHA`: route `GET /repos/o/r/contents/config.json?ref=main` returns `{ sha: 'abc', content: <base64 of '{"siteTitle":"Café"}'> }`. Expect `{ sha: 'abc', text: '{"siteTitle":"Café"}' }`.
  - `getFileText gives null for a missing file`: route returns status 404. Expect `null`.
  - `getFileText without a connection gives an offline error`: fetch throws `TypeError`. Expect rejection with `err.offline === true`.

- [ ] **Step 2: Run the tests.** Run: `node --test test/github.test.js`. Expected: the three new tests FAIL (`getFileText` is not exported).

- [ ] **Step 3: Implement `getFileText`.** Encode the path as `saveFile` does. Use `getJson` with a not-found message and turn that `GitHubError` into `null`, as `pathExists` does. Then change the `readNow` closure in `saveFile` to call `getFileText` (keep its rule: any error except `CancelledError` gives `null`).

- [ ] **Step 4: Run all tests.** Run: `npm test`. Expected: all PASS, including the existing `saveFile` tests.

- [ ] **Step 5: Commit.**

```bash
git add app/js/github.js test/github.test.js
git commit -m "feat: getFileText reads one file with its SHA (#38)"
```

### Task 3: Site details in the site sheet

**Files:**
- Create: `app/js/screens/site-config-view.js`
- Create: `test/site-config-view.test.js`
- Modify: `app/js/screens/site.js` (site sheet markup at line 145, sheet events at line 186)
- Modify: `app/sw.js` (add `js/screens/site-config-view.js` to `ASSETS`)

**Interfaces:**
- Consumes: Task 1 (`parseSiteConfig`, `checkSiteValues`, `applySiteConfig`, `needsAddressWarning`), Task 2 (`getFileText`), existing `saveFile`.
- Produces: `siteConfigHtml(state) -> string`, where `state` is one of:
  - `{ loading: true }`
  - `{ offline: true }`
  - `{ error: string }` (not valid JSON, token error, other GitHub error)
  - `{ config: object, warning: boolean }`

- [ ] **Step 1: Write the failing tests** in `test/site-config-view.test.js` (jsdom, as in `share-screens.test.js`):
  - `the form shows the three values as text`: `config` with `siteTitle: 'A <b>'`. Expect inputs `#site-url`, `#site-title` and `#site-description` with the values, no `<b>` element, and a button `#save-config` that is not disabled.
  - `the warning shows only when warning is true`: expect an element `[data-address-warning]` with text that contains `RSS feed` and `sitemap` only for `warning: true`.
  - `offline and error states disable the fields and Save`: for `{ offline: true }`, text `Not read: no connection to GitHub`. For `{ error: 'config.json is not valid JSON. Correct it on GitHub first.' }`, that text. In both, every input and `#save-config` is disabled.
  - `loading shows a spinner and disabled fields`.

- [ ] **Step 2: Run the tests.** Run: `node --test test/site-config-view.test.js`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `siteConfigHtml`.** It is a section with the heading `Site details` and the hint `The RSS feed and the sitemap use these values.` Labels: `Site address`, `Site title`, `Description`. The address input uses `type="url"`, `inputmode="url"`, `autocapitalize="off"` and `spellcheck="false"`. Use the `field`, `input` and `field-hint` classes from `add-site.js`, and `field-hint--error` hints with the ids `site-url-error` and `site-title-error`. Warning text: `This site uses the template's address, so its RSS feed and sitemap link to the wrong site. Type the address of your site and tap Save.` Add an empty `p.message-error#config-error` with `role="alert"` and a `p#config-saved` with `aria-live="polite"`. Use `escapeHtml` for all values.

- [ ] **Step 4: Run the tests.** Run: `node --test test/site-config-view.test.js`. Expected: PASS.

- [ ] **Step 5: Wire the sheet in `site.js`.**
  - Add `<div id="site-config"></div>` after the `checks` list in `#site-sheet`.
  - On `#open-site-sheet` click: when there is no read for this screen visit yet, render `{ loading: true }`, call `getFileText({ ...site, path: 'config.json', token, signal: controller.signal })`, parse the text, and render the result. Keep `{ sha, text }` in a closure variable. Do not read again when the sheet opens again in the same visit.
  - On `#save-config` click: call `checkSiteValues`. When there are errors, show them in the hints and stop. Otherwise call `saveFile({ ...site, path: 'config.json', text: applySiteConfig(text, values), sha, message: 'Update site settings with Gorilla To Go', token })`. `sha` is `undefined` when there was no file. Disable the button while it runs.
  - Success: keep the new `sha` and text, hide the warning when `needsAddressWarning` is now false, show `Saved. The site builds again with the new values.` in `#config-saved`, and call `showBuildStatus` as the editor does after a save, when that fits the screen's build-status code.
  - `err.conflict`: show `config.json changed on GitHub. Close this sheet and open it again to read the new file.`, and clear the closure, so the next open reads again. Other `GitHubError`: show `err.message`.

- [ ] **Step 6: Add `'js/screens/site-config-view.js'` to `ASSETS` in `app/sw.js`.**

- [ ] **Step 7: Run all tests.** Run: `npm test`. Expected: all PASS.

- [ ] **Step 8: Check in the browser** on `exhibita/gtg-test-site` (decision 23). Reuse a dev server on port 5173 if one runs; otherwise `npm run dev`, and stop it fully afterwards.
  1. Open the Pages screen. In DevTools Network, no request goes to `config.json`.
  2. Open the site sheet. One request goes to `contents/config.json`. The values show.
  3. Change the title and tap Save. On GitHub, the commit changes only the title line.
  4. Close and open the sheet. No new request.
  5. Set DevTools offline, reload, open the sheet. The offline text shows and the rest of the sheet works.

- [ ] **Step 9: Commit.**

```bash
git add app/js/screens/site-config-view.js test/site-config-view.test.js app/js/screens/site.js app/sw.js
git commit -m "feat: edit the site address, title and description in the site sheet (#38)"
```

### Task 4: Docs and release 0.17.0

**Files:**
- Modify: `docs/vanilla-gorilla-notes.md:34`
- Modify: `docs/future.md:25`
- Modify: `docs/decisions.md` (new row 39)
- Modify: `package.json`, `app/js/version.js`, `app/sw.js` (`VERSION`), `CHANGELOG.md`

- [ ] **Step 1: Replace `docs/vanilla-gorilla-notes.md` line 34** with: `- `config.json` is committed (vanilla-gorilla#14). It has `_comment`, `siteUrl`, `siteTitle` and `siteDescription`, and some sites also have `distributionId` and `awsProfile` for `invalidate.js`. The RSS feed and the sitemap use the three site values. `SITE_URL`, `SITE_TITLE` and `SITE_DESCRIPTION` environment variables win over the file.`
- [ ] **Step 2: Remove the vanilla-gorilla#5 line** from `docs/future.md` (line 25).
- [ ] **Step 3: Add decision 39** to `docs/decisions.md`: `| 39 | (2026-10-29) The site sheet edits `siteUrl`, `siteTitle` and `siteDescription` in `config.json` and keeps all other keys and their order. GTG reads `config.json` only when the user opens the site sheet, to keep the number of requests low. The sheet warns when `siteUrl` is missing or is the template address, except for `exhibita/vanilla-gorilla`. |`
- [ ] **Step 4: Set the version to `0.17.0`** in `package.json`, `app/js/version.js` and `VERSION` in `app/sw.js`.
- [ ] **Step 5: Add a `## 0.17.0 — <release date>` entry** at the top of `CHANGELOG.md`:
  - `Change the address, the title and the description of your site in the site sheet (the gear button). The RSS feed and the sitemap use these values.`
  - `The site sheet warns when your site still uses the address of the template.`
- [ ] **Step 6: Run `npm run changelog`, then `npm test`.** Expected: all PASS.
- [ ] **Step 7: Commit.**

```bash
git add docs package.json app/js/version.js app/sw.js CHANGELOG.md app/js/changelog-recent.js
git commit -m "chore: release 0.17.0 (#38)"
```
