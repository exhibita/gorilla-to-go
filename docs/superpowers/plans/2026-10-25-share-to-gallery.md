# Share Photos to a Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photos shared from another app reach a gallery: directly on Android (share target), and through an Apple Shortcut and a per-site inbox branch on iPhone.

**Architecture:** Both paths end in the existing gallery flow in the editor (resize, EXIF removed, alt text, one Publish commit). An in-memory handoff (`incoming.js`) gives the editor the files. Android files wait in the Cache API (`gtg-share`); iPhone files wait on the `gtg-inbox` branch. A small IndexedDB store (`inbox`) keeps the cleanup list and the purge record for each site.

**Tech Stack:** Vanilla ES modules, service worker, Cache API, IndexedDB, GitHub REST API, `node --test` with fake `fetch` and jsdom.

**Spec:** `docs/superpowers/specs/2026-10-25-share-to-gallery-design.md` (decisions 32–38 in `docs/decisions.md`).

## Global Constraints

- No framework, no third-party scripts, no change to the CSP (`connect-src https://api.github.com`).
- The token goes only through `auth.js` (`authorizationHeader`), as in `github.js` `request()`.
- Branch name `gtg-inbox`. Folder `gtg-inbox/` on that branch. Branch made from `site.branch`, never a hard-coded `main`.
- Android cache name `gtg-share`. The `activate` handler must not delete it.
- A photo leaves the inbox only after it is published (its commit succeeded) or after Discard.
- A file that is not a JPEG (`FF D8 FF`) or has the EXIF GPS tag `0x8825` can only be discarded.
- GitHub Support contact page: `https://support.github.com/contact`.
- Every new file in `app/` goes into `ASSETS` in `sw.js` (`test/service-worker.test.js` checks this).
- All user text in the spirit of ASD STE100. Touch targets 44 px. Help pages work offline.
- Release: version `0.16.0` in `package.json`, `app/js/version.js` and `sw.js` `VERSION`; a `CHANGELOG.md` entry; then `npm run changelog`.

## Review Focus

1. **An inbox photo that is already in an unpublished edit on this device** shows as "Added, not published", not as addable. Otherwise one user adds it twice. Test in Task 4 (`markPending`).
2. **The inbox branch disappears between the count and the open** (another user emptied it). The inbox screen says "No photos are waiting" with no error. Test in Task 4 (`listWaiting` on a missing branch).
3. **Offline on the site screen**: `countWaiting` returns `null`, and no row and no error show. Test in Task 4.
4. **Publish fails (409 conflict, offline) with inbox photos**: nothing goes on the cleanup list, so the photos stay waiting. The editor calls `cleanAfterPublish` only after `commitFiles` resolves (Task 5). The project does not run `editorScreen` in tests, so Task 8 checks this in the browser with a forced conflict.
5. **A share with a non-image file or zero files on Android**: the service worker keeps only `image/*` files. With zero files it redirects to `#/share`, and the screen says "No photos were received". Test in Task 2.

---

### Task 1: GitHub API functions for the inbox

**Files:**
- Modify: `app/js/github.js` (after `listFolder`, about line 523)
- Test: `test/github.test.js`

**Interfaces:**
- Produces:
  - `getRefSha({ owner, repo, branch, token, fetch, signal, timeoutMs }) -> Promise<string|null>`: `GET /git/ref/heads/{branch}`; `null` on 404.
  - `deleteBranch({ owner, repo, branch, token, fetch, signal, timeoutMs }) -> Promise<void>`: `DELETE /git/refs/heads/{branch}`; 204 and 422/404 (already gone) count as done; other statuses throw `GitHubError`.
  - `getBlobBytes({ owner, repo, sha, token, fetch, signal, timeoutMs }) -> Promise<Uint8Array>`: `GET /git/blobs/{sha}` with `accept: 'application/vnd.github.raw+json'`.
  - `listBranchCommits({ owner, repo, base, head, token, fetch, signal, timeoutMs }) -> Promise<string[]>`: `GET /compare/{base}...{head}`, returns `commits[].sha`; `[]` on 404.
- Existing, used unchanged: `listFolder`, `deleteFile` (with `branch: 'gtg-inbox'`).

- [ ] **Step 1: Write the failing tests** in `test/github.test.js`, with the existing `fakeFetch`:
  - `getRefSha returns the SHA of the branch, and null when the branch does not exist`: a 200 `{ object: { sha: 'abc' } }` → `'abc'`; a 404 → `null`.
  - `deleteBranch sends DELETE to the ref, and a branch that is already gone counts as deleted`: the call is `DELETE …/git/refs/heads/gtg-inbox`; 204 and 422 both resolve.
  - `getBlobBytes asks for the raw blob and returns the bytes`: `Accept` is `application/vnd.github.raw+json`; result `deepEqual` `new Uint8Array([0xff, 0xd8, 0xff])`.
  - `listBranchCommits lists only the commits of the inbox branch`: path `…/compare/main...gtg-inbox`; returns `['c1', 'c2']`.
- [ ] **Step 2: Run** `node --test test/github.test.js`. Expected: FAIL, the functions are not exported.
- [ ] **Step 3: Implement** the four functions with `request()`, `repoPath()` and `encodeURIComponent` on the branch names, as the other functions do.
- [ ] **Step 4: Run** `node --test test/github.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: GitHub calls for the share inbox (#35)`.

---

### Task 2: Android share target (manifest and service worker)

**Files:**
- Modify: `app/manifest.webmanifest`, `app/sw.js`
- Create: `app/js/share-store.js`
- Test: `test/service-worker.test.js`, `test/share-store.test.js`

**Interfaces:**
- Produces:
  - Manifest `share_target` exactly as in spec 7.1 (`action: "./share-target"`, `method: "POST"`, `enctype: "multipart/form-data"`, `params.files: [{ name: "photos", accept: ["image/*"] }]`).
  - In `sw.js`: `const SHARE_CACHE = 'gtg-share';`. A POST to `./share-target` puts each `image/*` file in `SHARE_CACHE` under the key `share/<shareId>/<index>` (a `Response` of the file with the headers `Content-Type` and `X-File-Name`, URI-encoded). It answers `Response.redirect(new URL('./#/share/' + shareId, self.registration.scope).href, 303)`. `shareId` is `Date.now()` and a random part.
  - `app/js/share-store.js`: `readShare(shareId, cachesApi = caches) -> Promise<File[]>`, `deleteShare(shareId, cachesApi = caches) -> Promise<void>` and `pruneShares(now = Date.now(), cachesApi = caches) -> Promise<void>` (deletes shares older than one day, from the time in `shareId`; a share that the user did not finish does not stay for ever). The Share screen calls `pruneShares` when it opens.

- [ ] **Step 1: Write the failing tests.**
  - `test/service-worker.test.js`: load `sw.js` in `node:vm` with a fake `self`, `caches` and `Response.redirect`. Collect the `fetch` listener. Then:
    - `a share POST keeps each image and redirects to the share screen`: two image files and one `text/plain` file → two cache entries; redirect status 303 to `…/#/share/<id>`.
    - `a share POST with no image redirects to the share screen and keeps nothing`.
    - `activate keeps the gtg-share cache`: the keys `gtg-0.1.0`, `gtg-share` and the current `gtg-<VERSION>` → only `gtg-0.1.0` is deleted.
    - `the manifest has the share target for images`: parse the manifest, `deepEqual` the object from spec 7.1.
  - `test/share-store.test.js`: with a fake `caches`, `readShare returns the files in order with their names and types`, `deleteShare removes every entry of the share` and `pruneShares deletes only the shares older than one day`.
- [ ] **Step 2: Run** `node --test test/service-worker.test.js test/share-store.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** In the `fetch` listener, handle the share POST *before* `if (request.method !== 'GET' …) return;`. In `activate`, exclude `SHARE_CACHE` from the delete filter. Add `share_target` to the manifest. Write `share-store.js`, and add `js/share-store.js` to `ASSETS`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS (the `ASSETS` test included).
- [ ] **Step 5: Commit** `feat: Android share target for photos (#35)`.

---

### Task 3: Photo checks and the incoming handoff (pure modules)

**Files:**
- Create: `app/js/inbox-logic.js`, `app/js/incoming.js`
- Test: `test/inbox-logic.test.js`, `test/incoming.test.js`

**Interfaces:**
- Produces:
  - `inbox-logic.js`: `export const INBOX_BRANCH = 'gtg-inbox'`, `export const INBOX_FOLDER = 'gtg-inbox'`.
  - `checkPhotoBytes(bytes: Uint8Array) -> { ok: true } | { ok: false, reason: 'not-jpeg' | 'gps' }`. Walk the JPEG segments from offset 2. In an APP1 segment (`FF E1`) that starts with `Exif\0\0`, read the TIFF header (byte order `II` or `MM`) and IFD0. When an entry has tag `0x8825`, return `gps`. Stop at SOS (`FF DA`). A broken or short file that starts with `FF D8 FF` and has no GPS tag is `ok`; `prepareImage` reports a decode failure later.
  - `problemText(reason) -> string`: `'gps'` → `'This photo has location data. Discard it.'`; `'not-jpeg'` → `'This is not a JPEG photo. Discard it.'`.
  - `incoming.js`: `setIncoming({ siteId, path, files: File[], origins: (null | { path, sha })[], onKept?: () => Promise<void> })` and `takeIncoming(siteId, path) -> entry | null`. One entry at a time; `takeIncoming` returns it once, then `null`.

- [ ] **Step 1: Write the failing tests.**
  - `checkPhotoBytes accepts a JPEG without EXIF`.
  - `checkPhotoBytes accepts a JPEG with EXIF but no GPS` (build the bytes in the test: SOI, APP1 `Exif\0\0`, `II*\0`, IFD0 with one entry `0x0112`).
  - `checkPhotoBytes finds GPS in little-endian and big-endian EXIF` (IFD0 with an entry `0x8825`).
  - `checkPhotoBytes refuses a HEIC file` (bytes `00 00 00 18 66 74 79 70 68 65 69 63`) → `not-jpeg`.
  - `checkPhotoBytes does not read past the end of a short file`: `[0xff, 0xd8, 0xff, 0xe1, 0x00]` → `{ ok: true }`, no throw.
  - `takeIncoming returns the entry once, and only for the same site and path`.
- [ ] **Step 2: Run** `node --test test/inbox-logic.test.js test/incoming.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules. Add both to `ASSETS`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: photo checks and incoming handoff (#35)`.

---

### Task 4: Inbox module (waiting list, discard, cleanup, branch delete, purge record)

**Files:**
- Modify: `app/js/db.js` (version 4, store `inbox`, key `siteId`), `app/js/edits.js` (`listSiteEdits`)
- Create: `app/js/inbox.js`
- Test: `test/inbox.test.js`

**Interfaces:**
- Consumes: Task 1 functions; `listFolder`, `deleteFile`; Task 3 `checkPhotoBytes`, `INBOX_BRANCH`, `INBOX_FOLDER`.
- Produces in `edits.js`: `listSiteEdits(siteId) -> Promise<edit[]>`: all kept edits of the site (as `listNewPages`, without the `baseSha` filter). The inbox screen passes the result to `markPending`.
- Produces (each takes `{ site, token, fetch = globalThis.fetch, store = inboxStore }`, as `pages.js` does with `deviceStore`):
  - `export const inboxStore`: `get(siteId)` and `put(record)` over db store `inbox`. Record: `{ siteId, cleanup: [{ path, sha }], purgeNeeded: boolean, purge: null | { repo: 'owner/repo', commits: string[] } }`. `export function memoryInboxStore()` for tests.
  - `countWaiting(opts) -> Promise<number|null>`: runs `runCleanup` first, then `listFolder` on `INBOX_BRANCH`. Returns `null` on any error (offline included).
  - `listWaiting(opts) -> Promise<[{ name, path, sha, bytes: Uint8Array, problem: null | 'gps' | 'not-jpeg' }]>`: lists, downloads with `getBlobBytes` (at most 4 in parallel), checks each file. When any file has a problem, it sets `purgeNeeded: true`.
  - `markPending(waiting, edits) -> waiting`: adds `pending: true` to each item whose `sha` is an `image.inbox.sha` in any of the site's local edits (`edits` from `edits.js`).
  - `discard(opts & { item }) -> Promise<void>`: `deleteFile` on `INBOX_BRANCH` with the item's SHA, then `deleteBranchIfEmpty`.
  - `recordPublished(opts & { origins: { path, sha }[] }) -> Promise<void>`: appends to `cleanup`.
  - `runCleanup(opts) -> Promise<void>`: deletes each listed file (already gone = done) and removes it from the list after each delete. Then, only when it deleted at least one file, `deleteBranchIfEmpty`. With an empty list it sends no request, so a site open costs no write.
  - `deleteBranchIfEmpty(opts) -> Promise<{ deleted: boolean }>`: `getRefSha` first; `null` (no branch) → `{ deleted: false }` and no `DELETE`. Lists the folder; if it is not empty, stop. Lists again; if still empty: when `purgeNeeded`, store `purge` with `listBranchCommits(base: site.branch, head: INBOX_BRANCH)`. When `listBranchCommits` fails, do not delete the branch this time (the commit IDs must be kept first). Then `deleteBranch`.
  - `clearPurge(opts) -> Promise<void>`: sets `purge: null`, `purgeNeeded: false`.
  - `inboxOrigins(images) -> { path, sha }[]`: the `inbox` field of each image that has one.
  - `cleanAfterPublish(opts & { images }) -> Promise<void>`: when `inboxOrigins(images)` is not empty, `recordPublished`, then `runCleanup`. Errors are caught and ignored (the next site open retries).

- [ ] **Step 1: Write the failing tests** in `test/inbox.test.js`, with a fake `fetch` and `memoryInboxStore()`:
  - `countWaiting counts the files in the inbox folder`.
  - `countWaiting returns null when there is no connection` (fetch throws).
  - `listWaiting returns an empty list when the inbox branch does not exist` (404).
  - `listWaiting marks a GPS photo and sets purgeNeeded`.
  - `markPending marks a photo that a local edit already has`.
  - `runCleanup deletes the published files and keeps a file whose delete failed on the list`.
  - `runCleanup counts a file that is already gone as deleted`.
  - `the branch is deleted only when the folder is empty on both reads`: the second read returns a new file → no `DELETE` call.
  - `before the branch delete, the commit IDs are kept when a bad file was seen`: `purge.commits` equals the compare result, and the `compare` call comes before the `DELETE`.
  - `no purge record when no bad file was seen`.
  - `no DELETE when the inbox branch does not exist` (`getRefSha` → 404).
  - `runCleanup with an empty list sends no request`.
  - `the branch is kept when the commit IDs cannot be read` (`purgeNeeded`, compare → 500 → no `DELETE`).
  - `cleanAfterPublish deletes only the images that came from the inbox`: images `[{ path: 'src/a.jpg', inbox: { path: 'gtg-inbox/a.jpg', sha: 's1' } }, { path: 'src/b.jpg' }]` → one `DELETE …/contents/gtg-inbox/a.jpg` with `branch: 'gtg-inbox'`.
  - `cleanAfterPublish does nothing for images without an inbox origin` (no request, the store stays empty).
- [ ] **Step 2: Run** `node --test test/inbox.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `inbox.js` and `listSiteEdits`. In `db.js`, set `DB_VERSION = 4`, add the `inbox` store in `onupgradeneeded`, and update the header comments (the store list, the version note, and `inbox.js` in the list of modules that use `db.js`). Add `js/inbox.js` to `ASSETS`. In `sites.js` `removeSite`, also remove the `inbox` record of the site.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: share inbox cleanup and purge record (#35)`.

---

### Task 5: Editor: `addPhotoFiles`, incoming photos and cleanup after Publish

The project does not run `editorScreen` in tests: the editor needs IndexedDB and canvas. The parts that can break are pure and tested in Tasks 3 and 4. This task is wiring, checked in the browser in Task 8.

**Files:**
- Modify: `app/js/screens/editor.js:720-768` (the Add photos handler), the end of the setup of `editorScreen`, and the `commitFiles` branch of Publish (about line 1209)
- Test: `test/images.test.js`

**Interfaces:**
- Consumes: Task 3 `takeIncoming`; Task 4 `cleanAfterPublish`.
- Produces: inside `editorScreen`, `addPhotoFiles(files: (File|Blob)[], origins?: (null | { path, sha })[]) -> Promise<number>` (the number added). A pending image with an origin gets the field `inbox: { path, sha }`. Checked on 2026-10-25: `keepNow` passes `referencedImages(...)` (a filter, same objects) to `saveLocalEdit`, which stores them as they are; `renameTakenImages` sets only `image.path` ([editor.js:1108](../../../app/js/screens/editor.js)). So the field stays on the device and after a rename. Keep it that way: do not rebuild image objects as `{ path, base64, mimeType }`.
- Produces in `images.js`: `photoFileName(file) -> string`: `file.name` when it has one, else `'photo.jpg'`.

- [ ] **Step 1: Write the failing test** in `test/images.test.js`: `photoFileName uses the file name, and photo.jpg for a Blob without a name`.
- [ ] **Step 2: Run** `node --test test/images.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `photoFileName` to `images.js`.
  - Move the body of the `#photo-files` change handler into `addPhotoFiles`. Use `photoFileName(file)` where the handler used `file.name`. The handler calls `addPhotoFiles([...input.files])`.
  - After the page is ready, call `takeIncoming(site.id, path)`. When there is an entry and the page is a gallery, show the Photos view, `await addPhotoFiles(entry.files, entry.origins)`, then `await entry.onKept?.()`.
  - In Publish, right after `pendingImages = pendingImages.filter(...)`, start `cleanAfterPublish({ site, token, images })` without `await`. Do not call it in the `saveFile` branch or in `catch`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: editor takes shared and inbox photos (#35)`.

---

### Task 6: Screens: Share (Android), Inbox, and the waiting row

**Files:**
- Create: `app/js/screens/share.js` (`#/share/<shareId>`), `app/js/screens/inbox.js` (`#/site/<id>/inbox`), and the HTML builders in their own modules, as `editor-links.js` is split from `editor.js`, so the tests do not load the screens' imports: `app/js/screens/gallery-picker.js`, `app/js/screens/inbox-view.js`
- Modify: `app/js/app.js` (routes), `app/js/router.js` (route list comment), `app/js/screens/site.js` (waiting row), `app/css/app.css`
- Test: `test/share-screens.test.js` (jsdom, the HTML builders only, as `test/editor-links.test.js` does)

**Interfaces:**
- Consumes: Task 2 `readShare`, `deleteShare`; Task 3 `setIncoming`, `problemText`; Task 4 `countWaiting`, `listWaiting`, `markPending`, `discard`, `clearPurge`, `inboxStore`; `loadPages`, `listSites`, `getToken`.
- Produces:
  - `gallery-picker.js`: `galleryPickerHtml(pages) -> string` (one 44 px row per page of type `gallery`, with its title; an empty list → "This site has no gallery." and a link to New page) and `galleries(pages) -> page[]`.
  - `inbox-view.js` exports the builders: `waitingCardHtml(item) -> string` (a photo card; a `problem` → `problemText` and only Discard; `pending` → "Added, not published"; all text escaped with `escapeHtml`), `purgeSheetHtml(purge) -> string`, `waitingRowHtml(count, purge) -> string` (empty string when `count` is `null` or `0` and there is no purge).
  - `gallery-picker.js` also exports `shareIntroText(count) -> string` ("Add 1 photo to a gallery", "Add 3 photos to a gallery", "No photos were received.").
  - Routes: `route(/^#\/share\/([^/]+)$/, shareScreen)`, `route(/^#\/site\/([^/]+)\/inbox$/, inboxScreen)`.

Screen behavior:
- **Share:** "Add N photos to a gallery". No sites → go to `#/`. One site → skip the site step. Zero files → "No photos were received." After a gallery is chosen: `setIncoming({ siteId, path, files, origins: files.map(() => null), onKept: () => deleteShare(shareId) })`, then navigate to that gallery's editor.
- **Inbox:** the waiting photos in a grid (thumbnails from `bytes` as `data:` URLs, which the CSP allows). A bad photo shows `problemText`, and only **Discard**. A pending photo shows "Added, not published". Each photo has **Discard** (confirm in a bottom sheet). **Add to a gallery** uses the gallery picker for all photos that have no problem and are not pending, then `setIncoming` with origins `{ path, sha }`. When the store has `purge`, show the purge sheet: the text from spec 8.5, the repository name, the commit IDs, **Copy**, a link to `https://support.github.com/contact` (`target="_blank" rel="noopener"`), and **Done** (`clearPurge`).
- **Site screen:** after the page list loads, call `countWaiting`. When it returns a number above 0, show a row "N photos waiting" with a link to the inbox screen. `null` or `0` → no row. Also show the row when `purge` is set ("Request a full purge").

- [ ] **Step 1: Write the failing tests** in `test/share-screens.test.js`:
  - `the gallery picker lists only galleries, and links to New page when there is none`.
  - `shareIntroText counts the photos, and says when no photos were received` (Review Focus 5).
  - `a GPS photo card shows the problem and only Discard`.
  - `a pending photo card says "Added, not published" and has no Add`.
  - `a photo name with HTML shows as text` (`<b>x</b>.jpg` → no `b` element).
  - `the purge sheet shows the repository, each commit ID and the GitHub Support link with rel="noopener"`.
  - `waitingRowHtml shows "3 photos waiting", and nothing for null or 0` (Review Focus 3).
- [ ] **Step 2: Run** `node --test test/share-screens.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the screens and the routes. Follow `docs/design.md`: cards, bottom sheets, 44 px targets, the Gallery label colors for the gallery rows. Add the new files to `ASSETS`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: share and inbox screens (#35)`.

---

### Task 7: The iPhone Shortcut: recipe and help page

**Files:**
- Create: `docs/ios-shortcut.md`
- Modify: `app/js/screens/help.js` (`SHORTCUT_PAGE`, `SHORTCUT_LINK = ''`, `shortcutHelpScreen`), `app/js/app.js` (route `#/help/shortcut`), `app/js/screens/inbox.js` (link to the help page)
- Test: `test/help-shortcut.test.js`

**Interfaces:**
- Produces: `export const SHORTCUT_LINK = ''` and `export const SHORTCUT_PAGE` in `help.js`. With an empty link, the page shows the setup steps and "Ask the site owner for the Shortcut link." With a link, it shows an **Add the Shortcut** button.

`docs/ios-shortcut.md` is for the owner, who builds the Shortcut on a borrowed iPhone. One action per step, with each setting. It has these parts, in this order:

1. **Before you start:** an iPhone with iOS 17 or later; sign in with your own Apple ID if you can (the link belongs to that account); the test site `exhibita/gtg-test-site` and a fine-grained token for it (Contents read and write).
2. **Build the Shortcut**, action by action:
   1. Shortcut settings: name "Send to Gorilla To Go"; **Show in Share Sheet** on; share sheet types: **Images** only.
   2. **Dictionary** "Sites": one key per site name. Each value is a dictionary with `owner`, `repo`, `branch`, `token`.
   3. **Choose from List** on the keys of "Sites", prompt "Which site?". Then **Get Dictionary Value** for the chosen site.
   4. **Get Contents of URL**: `GET https://api.github.com/repos/<owner>/<repo>/git/ref/heads/gtg-inbox`, headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`. **If** the result has no `object` key: **Get Contents of URL** `GET …/git/ref/heads/<branch>`, then `POST …/git/refs` with JSON `{ "ref": "refs/heads/gtg-inbox", "sha": <object.sha> }`.
   5. **Repeat with Each** shared image: **Convert Image** to JPEG, quality 0.8, **Preserve Metadata off**. **Get Details of Images** → Width. **If** Width > 1600: **Resize Image** to width 1600, height Auto. **Base64 Encode** (line breaks: None). **Format Date** (`yyyy-MM-dd-HHmmss`) and **Random Number** 1000–9999 for the name. **Get Contents of URL** `PUT …/contents/gtg-inbox/<date>-<number>-<index>.jpg`, JSON body `{ "message": "Photo for the gallery inbox", "content": <base64>, "branch": "gtg-inbox" }`.
   6. **Show Notification**: "N photos sent to <site>. Open Gorilla To Go to add them to a gallery."
3. **Test on the test site:** share 1 photo, then 5 photos. On github.com, open the `gtg-inbox` branch and check: the files are `.jpg`; each is at most 1600 px wide; no location data. To check the location, download one file and open it in a tool that shows EXIF. Then open GTG and add the photos to a gallery.
4. **Remove your token before you share:** set each `token` value to empty. Then, in the Shortcut settings, open **Import Questions** and add one question for each site's `token` ("Paste the GitHub token for <site>"), plus questions for the site list if other people use other sites.
5. **Make the iCloud link:** Share → Copy iCloud Link. Send the link to the developer. It goes into `SHORTCUT_LINK` in `app/js/screens/help.js`.
6. **If the link stops working:** build the Shortcut again from this document.

- [ ] **Step 1: Write the failing tests** in `test/help-shortcut.test.js`:
  - `the Shortcut help page shows the setup steps without a link while SHORTCUT_LINK is empty`.
  - `the Shortcut recipe tells the user to turn off Preserve Metadata and to remove the token before sharing` (read `docs/ios-shortcut.md`, match `/Preserve Metadata/` and `/Import Questions/`).
- [ ] **Step 2: Run** `node --test test/help-shortcut.test.js`. Expected: FAIL.
- [ ] **Step 3: Write** the help page, the route and `docs/ios-shortcut.md`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `docs: iPhone Shortcut recipe and help page (#35)`.

---

### Task 8: Release 0.16.0 and checks

**Files:**
- Modify: `package.json`, `app/js/version.js`, `app/sw.js` (`VERSION`), `CHANGELOG.md`, `app/js/changelog-recent.js` (made by `npm run changelog`), `README.md` (feature list, if it lists features)

- [ ] **Step 1:** Set the version to `0.16.0` in the three files. Add the `CHANGELOG.md` entry: Android share to a gallery; iPhone Shortcut and the inbox; Discard; checks for location data and HEIC; the purge request.
- [ ] **Step 2: Run** `npm run changelog`, then `npm test`. Expected: PASS, with no test skipped.
- [ ] **Step 3: Browser check** on the dev server (reuse port 5173 if it listens; not Live Server), against `gtg-test-site`. Upload files by hand to `gtg-inbox/` on the `gtg-inbox` branch. Check each item:
  1. The site screen shows "2 photos waiting". Offline (DevTools), it shows no row and no error.
  2. Add one photo to a gallery, then remove it before Publish. Add the other and publish. On GitHub, only the published file is gone from the inbox.
  3. Force a conflict: change the gallery on github.com after you open it, then publish inbox photos. The publish fails, and the photos stay waiting (Review Focus 4).
  4. Discard the last photo. The `gtg-inbox` branch is deleted.
  5. Upload a JPEG with GPS data. The card shows the problem. Discard it. After the branch delete, the purge sheet shows the commit IDs.
  6. Add photos to a gallery, then close the tab before the cleanup ends (DevTools offline right after Publish). Go online and open the site again. The photos do not show as waiting.
- [ ] **Step 4: Commit** `chore: release 0.16.0 (#35)`.
- [ ] **Step 5:** Give the owner the device test list from spec section 13. The iPhone tests wait for the Shortcut.
