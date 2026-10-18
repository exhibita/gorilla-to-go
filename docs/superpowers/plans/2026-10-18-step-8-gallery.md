# Step 8: Gallery Screen — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Manage the photos of a gallery page from the phone: see them in a grid, add photos, change the alt text and caption, change the order, and remove photos. Publish the page and its new photos in one commit.

**Spec:** `docs/mvp-plan.md` section 2 ("Galleries": an `images:` list with path, alt text and caption), section 6 screen 6 ("a grid of images. Add, reorder and remove images, and edit alt text"), section 7 (image handling), section 8 step 8; decision 21 (fields `path`, `alt`, `caption`; `path` is `./images/...`); `vanilla-gorilla/docs/UPGRADE-v2.md` (the first image is the cover, unless `cover:` is set; no `alt` → the build uses the caption). The mockups have no Gallery screen.

## Global Constraints

- **My call:** the Gallery screen is a third view in the editor for gallery pages: Write | Photos | Preview. The photo list is front matter of the same file, so the text and the photos share one set of unsaved changes on the device, one Restore, one conflict check and one Publish.
- The app changes only the `images:` block of the front matter, and only when the list changed. Other keys, comments and line endings stay byte for byte. Unknown keys in an item stay.
- Written format: `  - path: ./images/gallery/<slug>/<name>` with `alt:` and `caption:` lines (text in double quotes). An empty alt text or caption is left out, so the build can use the caption as the alt text.
- New photos: the step 7 rules (re-encode, max 1600 px, no EXIF, names unique in the page, on the device and on GitHub), in `src/images/gallery/<slug>/`. Several photos can be added at once.
- Remove = remove from the list. The image file stays in the repository (image cleanup is in `future.md`); the app says so. A new photo that is removed before Publish is not uploaded.
- Reorder: "Move earlier" and "Move later" in the photo sheet (buttons work with a screen reader; drag and drop does not). The first photo is the cover on the gallery index, unless the page has `cover:`; the grid marks it.
- A rename at Publish (step 7) also changes the path in the `images:` list.
- Preview shows the text and then the photos in a grid, as the site does.
- Front matter that the app cannot read: the Photos view is off (as Details).
- Same rules as before: CSP, STE100, 44 px, token only through `auth.js`. Version 0.8.0.

## Review Focus

1. **Byte-for-byte front matter** — an unchanged list leaves the file exactly as it was; a changed list changes only the `images:` block. Tests: `setImages`.
2. **List forms** — items at column 0, items with extra keys, scalar items, an empty `images:` key, no key. Tests.
3. **Rename at Publish** for a gallery photo changes the list path, so the page never points to another file.
4. **Many photos at once** — names stay unique; a failure on one photo does not stop the others.
5. **A removed new photo** is not uploaded.

## Tasks

1. `app/js/frontmatter-write.js` (TDD): `setImages(raw, items)`.
2. `app/js/images.js` (TDD): `galleryItems(data)`, `galleryImagePath(path)`, `moveItem(list, from, to)`.
3. Editor: the Photos view (grid, Add photos, photo sheet, cover mark), the list in `currentText()`, rename in the list, Preview grid.
4. Version 0.8.0, browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Open the Earthy Lightshow gallery (or make a new gallery), tap Photos. The grid shows the photos with the first as the cover.
2. Add two photos at once, give each an alt text and a caption, move one to the first place, remove an old one. Publish. GitHub shows ONE commit with `index.md` and the new images; the site shows the new order, the captions and the lightbox.
3. Check `index.md` on GitHub: only the `images:` block changed.
