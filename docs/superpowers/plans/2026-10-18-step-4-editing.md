# Step 4: Editing and Saving — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Edit a page in a plain textarea with a toolbar, see a Preview rendered like the site, change the title, date and description, and publish the change to GitHub without overwriting a change made by someone else.

**Spec:** `docs/mvp-plan.md` (sections 1, 5 "Edit", 6 screen 5, 8 step 4, 9 risks), `docs/decisions.md` (4, 25), `docs/design.md` (editor layout, 16 px text, 44 px targets), mockup "Editor" (`Editor.dc.html`).

## Global Constraints

- Plain `<textarea>` with a custom toolbar (decision 4). Toolbar above the keyboard: heading, bold, italic, link, list, undo. The image button comes with image upload (step 7).
- Preview uses `marked` 18.0.6, copied into `app/vendor/marked/` with its MIT license (decision 25), with the default options, as `build.js` calls `marked.parse(body)`.
- The preview HTML comes from repository content, so it goes through an allowlist sanitizer before it is shown (the CSP is the second line of defense). Images in the preview show their alt text until step 7.
- Edit = read the file and its SHA, change it, commit with that SHA (mvp-plan section 5). A changed file on GitHub (409) stops the save: the app never overwrites (mvp-plan section 9).
- Write valid YAML: text values in double quotes; a date as `YYYY-MM-DD`; only the edited front matter lines change; the other keys, their order and the line endings stay as they were.
- The slug and the path do not change (mvp-plan section 5).
- Unsaved changes are kept on the device (IndexedDB) while the user types, so leaving the editor or a closed app loses nothing (mvp-plan sections 1 and 9).
- The app must stay open until a commit is complete (iOS): show "Publishing" and warn before the page closes.
- A page whose front matter the app cannot read: the text can be edited, the front matter stays as it is, Details is not available.
- STE100 text, CSP rules, 16 px inputs, 44 px targets, token only through `auth.js`.

## Review Focus

1. **Round trip** — opening and publishing a page with no change must not change one byte (CRLF, BOM, no front matter, block values, comments). Test: `compose(split(text)) === text` for the samples and the 28 real pages.
2. **Someone changed the page on GitHub** — the save stops with a clear message, the user's text stays on the device and can be copied. Test: `saveFile` 409 → conflict.
3. **Text with quotes, colons, `#`, backslashes or line breaks in the title or description** — the written YAML is valid and reads back the same. Test: write then parse.
4. **A closed app or no connection while editing** — the text is still there next time, with a Restore choice. Check: browser.
5. **Hostile HTML in a page** (`<script>`, `onerror=`, `javascript:` links) — the Preview shows nothing that runs. Check: browser, with a sample page.

## Tasks

1. `app/js/frontmatter-write.js` (TDD): `splitPage(text) → { bom, eol, raw, body, hasFrontmatter }`, `composePage(parts) → text`, `yamlText(value)`, `setFields(raw, { title, date, description })` (changes only those lines, removes an empty description, adds missing keys).
2. `app/js/editor-logic.js` (TDD): `toggleWrap`, `toggleLinePrefix` (heading, list), `insertLink`, `createHistory` (undo stack). Each takes and returns `{ text, start, end }`.
3. `app/js/github.js` (TDD): `saveFile({ owner, repo, branch, path, text, sha, message, token, fetch, signal }) → { sha }`; 409/422 → `GitHubError` with `conflict: true`; UTF-8 base64.
4. `app/js/pages.js` (TDD): `recordSavedPage({ site, path, sha, text, store })` updates the saved list and text, and makes the next load read the tree again. `app/js/edits.js`: local edits in a new IndexedDB store `edits` (version 3).
5. `app/vendor/marked/` + `app/js/sanitize.js` + the editor screen `#/site/<id>/edit/<path>` + an Edit button on the page view. Version 0.3.0.
6. Browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Open "Test Page", tap Edit, change one word, tap Publish. GitHub shows one commit with only that change. The site updates after the deploy.
2. Open the page in the app on two devices (or edit it on github.com while the app has it open), publish from the app: "This page changed on GitHub" appears, and nothing is overwritten.
3. Change the title to `Recipe: "Pasta" & more`. Publish. The site build succeeds, and the title shows as typed.
4. Type some text, close the app, open it again: the Restore choice appears.
