# Step 6: Page Deletion — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Delete a page from the phone, with a confirmation step.

**Spec:** `docs/mvp-plan.md` (section 5 "Delete" and the rule "Ask for confirmation before a delete", section 8 step 6, section 9 "Edit conflicts"), `docs/vanilla-gorilla-notes.md` ("Deleting a page does not delete its images"), `docs/design.md` (bottom sheets for confirmations), `docs/future.md` (image cleanup comes later).

## Global Constraints

- Delete = delete the file on GitHub in one commit (`DELETE /repos/{o}/{r}/contents/{path}` with the SHA of the file the user opened). The next build updates the index pages, the RSS feed and the sitemap (mvp-plan section 5).
- Ask for confirmation first, in a bottom sheet (mvp-plan section 5, design.md).
- Do not delete a page that changed on GitHub after the user opened it: GitHub refuses a delete with an old SHA (409). The app says so and deletes nothing.
- The images of the page stay in the repository (vanilla-gorilla-notes; image cleanup is in future.md). The confirmation says so.
- Unpublished changes of that page on this device are deleted too, and the confirmation says so.
- A delete that times out may have reached GitHub: the app checks whether the file is still there (as Publish does).
- After the delete: the page goes out of the saved list, its saved text is pruned, and the Pages list shows without it.
- Commit message: `Delete <slug> with Gorilla To Go`.
- Same rules as before: CSP, STE100 text, 44 px targets, token only through `auth.js`. Version 0.5.0.

## Review Focus

1. **The page changed on GitHub** after it was opened — nothing is deleted. Test: `deleteFile` 409 with another SHA → conflict.
2. **A delete that timed out but reached GitHub** — success, not an error. Test: network error, then the file is gone → success.
3. **The page is already gone** (deleted on github.com or in another tab) — the app treats it as deleted. Test: 404/409 and the file is gone → success.
4. **Unpublished changes or a "Not published" card** for that page — the confirmation names them; they are deleted with the page.
5. **Two quick taps** on Delete — one request.

## Tasks

1. `app/js/github.js` (TDD): `deleteFile({ owner, repo, branch, path, sha, message, token, fetch })`.
2. `app/js/pages.js` (TDD): `recordDeletedPage({ site, path, store })`.
3. Page view: a "Delete page" button at the end; a confirmation sheet; after the delete, back to the Pages list. `site.js`: forget the remembered list of the site, so the list shows without the page.
4. Version 0.5.0, browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Open the test post from step 5, tap Delete page, confirm. GitHub shows one "Delete …" commit, the page is gone from the list, and after the deploy the site no longer shows it (also not in the blog index and the RSS feed).
2. Open a page, change it on github.com, then delete it in the app: the app refuses and deletes nothing.
