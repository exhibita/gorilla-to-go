# Step 7: Image Upload — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Add a photo to a page from the phone: pick it, make it smaller, describe it, insert it at the cursor, see it in the Preview, and publish the page and its images in one commit.

**Spec:** `docs/mvp-plan.md` section 7 (max width 1600 px; `src/images/<type>/<slug>/`; page and images in one commit with the Git Data API, so one deploy; `![alt](path)` at the cursor), section 8 step 7, section 9 (edit conflicts, iOS storage); decision 21 (GTG writes `./images/...` paths); `docs/vanilla-gorilla-notes.md` (build.js rewrites only `./` paths); mockup "Editor" (the image button in the toolbar).

## Global Constraints

- Images of a page go in `src/images/<type>/<slug>/` (type from the page path: blog, gallery, page). The Markdown uses `./images/<type>/<slug>/<name>` (decision 21), the only prefix that `build.js` rewrites for the page depth.
- **Always re-encode** with a canvas: width at most 1600 px, and the copy has no EXIF data (no GPS location). `createImageBitmap(file, { imageOrientation: 'from-image' })` keeps the rotation. JPEG (quality 0.85) for photos; PNG when the source is PNG. GIF (animation) and SVG (active content) are refused with a message. A format the browser cannot decode (for example HEIC on Android) gets "This image format is not supported. Use a JPEG or PNG."
- Alt text: asked in a sheet before the insert ("Describe the image for people who cannot see it"). Strongly asked for, not forced.
- File names: from the original name (slug), with a `-2`, `-3` suffix when the name is used in the page text, by another pending image, or (online) on GitHub. At Publish, each image is checked on GitHub again; a name that exists stops the publish with a message (a Git tree entry overwrites without a warning).
- Pending images are kept with the page's unsaved changes on the device (the `edits` record, base64 strings), so Restore, Discard, Delete and Remove site already cover them.
- Only images that the text still references are uploaded.
- **One commit** for the page and its images (Git Data API): ref → commit → tree; check that the page's current SHA in that tree is the SHA the user opened (or that a new page does not exist); blobs; tree on that base; commit; update the ref with `force: false`. If the branch moved meanwhile (422), do the whole check again (at most 3 times). After a time-out on the ref update, read the ref: when it points at the new commit, the publish succeeded.
- Publish without pending images keeps using the Contents API (`saveFile`).
- Preview: images under `./images/` show (pending ones from the device; others read from GitHub with `Accept: application/vnd.github.raw`, shown as `data:` URLs, which the CSP allows). Other images keep the text note.
- Progress: "Uploading image 2 of 3"; Publish stays off; the warning before the page closes stays on.
- Same rules as before: CSP, STE100, 44 px, token only through `auth.js`. Version 0.7.0.

## Review Focus

1. **The branch moves during the commit** — the app checks again and never overwrites a newer page. Test: ref update 422 → retry.
2. **An image name that exists on GitHub** — a new name at insert, a stop at Publish; never an overwrite. Tests: `imageName`; publish check.
3. **A deleted image line** — its file is not uploaded. Test: `referencedImages`.
4. **A big photo** (for example 20 MB) — it is made smaller; a decode failure gives a message, not a broken page.
5. **App closed with pending images** — Restore brings back the text and the images.

## Tasks

1. `app/js/images.js` (TDD): `imageFolder(pagePath)`, `imageName(fileName, takenNames)`, `markdownPath(repoPath)`, `repoPath(markdownPath)`, `fitWidth(width, height, max)`, `markdownImage(alt, path)`, `referencedImages(text, images)`.
2. `app/js/github.js` (TDD): `commitFiles({ owner, repo, branch, page: { path, text, sha }, images: [{ path, base64 }], message, token, fetch, onProgress })` → `{ sha }` of the page blob; `getImageDataUrl({ owner, repo, branch, path, token, fetch })`.
3. Editor: the Image button (7 buttons), file input, resize/re-encode (`app/js/image-resize.js`, browser only), alt text sheet, insert at the cursor, pending images on the edit record, Publish with `commitFiles` when needed.
4. Sanitizer and Preview: `./images/` images resolve to `data:` URLs.
5. Version 0.7.0, browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Edit a post, tap the image button, pick a portrait photo, type the alt text, Publish. GitHub shows ONE commit with the page and `src/images/blog/<slug>/<name>.jpg`; one deploy; the photo shows upright on the live post, at most 1600 px wide.
2. Check that the committed photo has no GPS location (for example with exiftool, or a site that shows EXIF).
3. Preview shows the photo before and after Publish.
4. Edit the page on github.com between opening and Publish: the app stops and uploads nothing.
5. Pick a HEIC or GIF file: a clear message, nothing inserted.
