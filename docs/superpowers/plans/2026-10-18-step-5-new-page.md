# Step 5: Page Creation — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Create a new blog post, page or gallery from the phone: title, type, address (slug) and description, then write it in the editor and publish it.

**Spec:** `docs/mvp-plan.md` (section 5 "Add" and rules, section 6 screen 4 "New page", section 8 step 5), `docs/vanilla-gorilla-notes.md` (paths), `docs/design.md` ("New page": a round sage button at the bottom right), mockup "Pages" (the round button), decisions 21 and 22.

## Global Constraints

- Paths: Blog post → `src/blog/<slug>/index.md`; Gallery → `src/gallery/<slug>/index.md`; Page → `src/<slug>/index.md` (vanilla-gorilla-notes).
- Front matter: `title`, `date` (today, the device's date, `YYYY-MM-DD`), `description` (only when typed), `skeleton` (`blog`, `page` or `gallery`) (mvp-plan section 5). Text values in double quotes.
- The slug comes from the title and can be changed before the page is published. After that it cannot change (mvp-plan section 5).
- Never overwrite a page that exists (mvp-plan section 5): the app checks the address before the editor opens, and Publish creates the file without a SHA, so GitHub refuses it when the file exists.
- **My call:** nothing is committed until Publish. Each commit to `main` deploys the site, so an empty page must not go live. The new page is kept on the device (the `edits` store, with no base SHA) until it is published, and the Pages list shows it as "Not published".
- A page address must not use a folder that the site uses already (for example `images`, `css`, `blog`, `gallery`, `templates`, `skeletons`).
- Same rules as before: CSP, STE100 text, 16 px inputs, 44 px targets, token only through `auth.js`.

## Review Focus

1. **A title with accents, emoji, quotes or only symbols** — a valid slug comes out, or the user must type one. Test: `slugify`.
2. **An address that exists** (in the list, on GitHub but not in the list yet, or a site folder) — the app refuses it with a clear message. Tests: `slugProblem`, `pathExists`; Publish without a SHA → "exists" message.
3. **Leaving the editor before Publish** — the new page is still there (Pages list, "Not published"), and the user can delete it.
4. **The device date** — a page made at 23:30 in California gets that day, not the next UTC day. Test: `localDate`.
5. **No connection** — the new page can be made and written; Publish waits for a connection.

## Tasks

1. `app/js/new-page.js` (TDD): `slugify(title)`, `slugProblem(slug, { type, existingPaths })`, `pagePath(type, slug)`, `localDate(date)`, `newPageText({ title, date, description, type })`.
2. `app/js/github.js` (TDD): `pathExists({ owner, repo, branch, path, token, fetch })` → true / false; offline → GitHubError.
3. Pages list: the round "New page" button; "Not published" cards for new pages kept on the device.
4. New page screen `#/site/<id>/new`: type (Blog post / Page / Gallery), title, address (from the title until the user changes it; shows `/blog/<slug>/`), description, Continue. Checks, then keeps the new page on the device and opens the editor.
5. Editor: a new page (no base SHA) opens from the device copy, Back goes to the Pages list, Publish creates the file without a SHA ("exists" message on refusal), then the editor works as for any page. "Delete this new page" with a confirmation.
6. Version 0.4.0, browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Tap the round button, choose Blog post, type a title, tap Continue, write a few words, Publish. GitHub shows one new file `src/blog/<slug>/index.md`, and the site shows the post after the deploy.
2. Try the address of an existing post: the app refuses it.
3. Make a new page, go back without Publish: the Pages list shows it as "Not published". Open it, then delete it.
