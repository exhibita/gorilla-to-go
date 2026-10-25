# Share photos to a gallery: design

Issue: [#35](https://github.com/exhibita/gorilla-to-go/issues/35). Branch: `35-enable-share-to-to-add-photos-to-gallery`.

## 1. Intent

A user selects photos in another app (for example Photos) and sends them to a gallery of a site. The user does not have to open GTG first and look for the photos again.

The users are one or more persons who work on several sites. On a site, the users share one GitHub token (PAT). The owner accepts this risk.

## 2. Why two paths

- **Android:** an installed PWA can be a share target (`share_target` in the web app manifest). GTG gets the photos directly.
- **iPhone:** iOS Safari does not support `share_target` (status on 2026-10-25). GTG cannot be in the iOS share sheet. An Apple Shortcut is in the share sheet instead. The Shortcut uploads the photos to an inbox in the site repository. GTG reads the inbox later.

On iPhone, the gallery **Add photos** button already accepts many photos at once (`#photo-files` has `multiple`, [editor.js:171](../../../app/js/screens/editor.js)). That stays as it is.

## 3. Goals

1. Android: GTG is in the share sheet. A share opens GTG at a screen where the user chooses a site and a gallery.
2. iPhone: a Shortcut in the share sheet asks "Which site?" and uploads the photos to that site's inbox.
3. GTG shows "N photos waiting" on a site when its inbox has photos. The user chooses a gallery and adds them.
4. Photos from both paths go through the existing gallery flow: resize, EXIF removed, alt text, caption, one Publish commit.
5. When the inbox is empty, GTG deletes the inbox branch.

## 4. Non-goals

- No server. GTG stays a static app on GitHub Pages. The CSP stays as it is (`connect-src https://api.github.com`).
- No per-user inboxes. A site has one shared inbox. Any user of the site can add any waiting photo.
- No change to the Add photos button.
- No share target for other file types (text, links, video).
- No check of inbox files and no purge of inbox commits from GitHub. The help page warns iPhone users instead (8.5).

## 5. Anti-goals (a failure even if it works)

- Android users must do iPhone work. An Android user never installs a Shortcut, never enters a second token and never needs the inbox. The only inbox item an Android user sees is "N photos waiting" when an iPhone teammate shared photos to the site.
- A photo is lost. A photo leaves the inbox only after it is published in a gallery, or when a user taps Discard on it.
- A share causes a site deploy before Publish. The inbox is on its own branch. Only Publish commits to the site branch.
- An iPhone user is not told that a shared photo stays in the repository history (8.5).

## 6. Constraints

- Vanilla HTML, CSS and JavaScript. No third-party scripts. Keep the strict CSP.
- Keep the sign-in code in one module (`auth.js`). The inbox code uses the site token as all other GitHub calls do.
- All help pages work offline (decision 16).
- When you add a file to `app/`, add it to `ASSETS` in `sw.js`. A test checks this.
- The site templates deploy only on a push to `main` (`deploy.yml` and `pages.yml` in `exhibita/vanilla-gorilla`, checked 2026-10-25). A push to `gtg-inbox` does not deploy.

## 7. Android path

### 7.1 Manifest

Add `share_target` to `app/manifest.webmanifest`:

```json
"share_target": {
  "action": "./share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": { "files": [{ "name": "photos", "accept": ["image/*"] }] }
}
```

Chrome on Android shows GTG in the share sheet only when GTG is installed.

### 7.2 Service worker

Now `sw.js` ignores each request that is not a GET. So a share POST goes to GitHub Pages and fails. Add this before that line:

1. When the request is a POST to `./share-target`, read `request.formData()`.
2. Put each file in the Cache API, in a cache named `gtg-share` (not the versioned `gtg-<VERSION>` cache, so an update does not delete it). Use a new key for each share.
3. Answer with `Response.redirect('./#/share', 303)`.

Use the Cache API, not IndexedDB. `db.js` owns the database version and the `onversionchange` handling. A service worker that opens the same database adds a second owner.

The `activate` handler deletes old `gtg-*` caches. It must not delete `gtg-share`.

### 7.3 Share screen (`#/share`)

1. Read the shared files from `gtg-share`.
2. Show "Add N photos to a gallery". The user chooses a site, then a gallery of that site. Only galleries show.
3. Open the editor of that gallery in the Photos view, with the photos added (section 9).
4. Delete the files from `gtg-share` when they are kept in the local edit.

When there are no sites, show the welcome screen. When the site has no gallery, say so and link to New page.

## 8. iPhone path

### 8.1 The inbox

- Branch: `gtg-inbox`, made from the site branch (`site.branch`).
- Folder: `gtg-inbox/` at the root of that branch. Each photo is one file with a unique name: date, time and a random part, for example `gtg-inbox/2026-10-25-143012-k3f9.jpg`.
- Parallel uploads do not collide, because each file name is new.
- The inbox is shared by all users of the site.

### 8.2 The Shortcut

The Shortcut is in the iOS share sheet for images. It does these steps:

1. Ask "Which site?" from its site list. Each entry has: name, owner/repo, site branch and token.
2. For each photo: convert to JPEG with **Preserve Metadata off**, and resize to at most 1600 px wide (`MAX_WIDTH` in `images.js`). This step is required. iPhone photos are HEIC, and Android Chrome cannot read HEIC. A public repository shows the inbox branch on github.com (see 8.5).
3. Get the ref `heads/gtg-inbox`. When it does not exist, get the ref of the site branch and create `refs/heads/gtg-inbox` from its SHA.
4. For each photo: `PUT /repos/{owner}/{repo}/contents/gtg-inbox/<unique name>.jpg` with `branch: gtg-inbox`, the base64 content and a commit message.
5. Show "N photos sent to <site>. Open Gorilla To Go to add them to a gallery."

Setup:

- When someone adds the Shortcut, Import Questions ask for the site list and the token. The shared copy never contains a token.
- Token: a fine-grained PAT with Contents (read and write) on the site repositories. One fine-grained token covers repositories of one owner only. Sites of different owners need one token for each owner. The site list keeps the token with each site.

Delivery:

- The owner builds the Shortcut by hand on a borrowed iPhone and makes the iCloud link (owner's decision, 2026-10-25). A builder cannot make or sign a Shortcut from the repository.
- `docs/ios-shortcut.md` has the full recipe, action by action, for a person who does not use an iPhone every day. It includes: each action and its settings, the Import Questions, how to remove the token before sharing, how to test the Shortcut on a test site before sharing, and how to make the iCloud link. It also says that the iCloud link belongs to the Apple account that made it: when that account deletes the Shortcut, the link stops working. With the recipe, anyone can build it again.
- An in-app help page (like `help-install.js`) explains how to install and set up the Shortcut. It works offline. Until the owner gives the iCloud link, the page shows the setup steps without the link. Adding the link is a one-line change.

### 8.3 GTG reads the inbox

1. On the site screen, GTG lists `gtg-inbox/` on the `gtg-inbox` branch (`listFolder` returns `[]` when the branch or folder does not exist).
2. When there are photos, show "N photos waiting" with an **Add to a gallery** button. When the check fails or the app is offline, show nothing and no error.
3. The user taps the button and sees the waiting photos. Each photo has a **Discard** button (owner's decision, 2026-10-25). Discard asks for confirmation, then deletes that file from the inbox at once.
4. The user chooses a gallery for the remaining photos.
5. GTG downloads each photo by its blob SHA (`application/vnd.github.raw+json`, as `github.js` does now), makes a `File`, and adds the files to the gallery (section 9).
6. When a user adds an inbox photo to a gallery and then removes it before Publish, the photo is not deleted. It stays in the inbox and shows as waiting again.

### 8.4 Inbox cleanup

1. Each pending image in the local edit keeps its inbox origin: `{ inboxPath, inboxSha }`.
2. After `commitFiles` on the site branch succeeds, GTG first writes the published inbox files to a cleanup list on the device (a new IndexedDB store, for example `inboxCleanup`, keyed by site; this changes the `db.js` version). Only the images that were published go on the list.
3. GTG deletes those inbox files from `gtg-inbox`. A file that is already gone counts as deleted (as `deleteFile` does now). Each deleted file leaves the cleanup list.
4. When the app closes or goes offline before step 3 is done, GTG runs the cleanup list again the next time it opens that site, before it counts the waiting photos. So a published photo does not show as waiting again.
5. Then GTG lists the inbox again. When it is empty, GTG reads the folder one more time just before the delete. When it is still empty, GTG deletes the branch (`DELETE /git/refs/heads/gtg-inbox`, a new `deleteBranch` function in `github.js`).
6. If a delete fails, the photo stays on the cleanup list and GTG tries again later. Nothing is lost.

Known limits (documented, not fixed):

- A Shortcut upload can arrive between the last check and the branch delete. That upload is lost from the inbox. The window is less than one second.
- Two users who add the same waiting photo at the same time both publish it. The user can remove the copy in the Photos view.
- After the branch is deleted, its commits are not on any branch, tag or pull request. GitHub removes them later. Until then, a person who knows the exact commit ID can open it. Only GitHub Support can purge them at once. The owner accepts this. The help page tells iPhone users (8.5).

### 8.5 Warning for iPhone users

Owner's decision, 2026-10-25: GTG does not check inbox files and offers no purge. The Shortcut help page and `docs/ios-shortcut.md` warn iPhone users instead. The warning is in a clear box near the top of the page. It says:

1. Each photo that the Shortcut sends goes into the history of the site repository. When the photo or the inbox is deleted later, the photo stays in the history.
2. A photo can contain its location (GPS data) and other data. An iPhone photo is often a HEIC file.
3. When the site repository is public, anyone can see that history on github.com.
4. So, when the repository is public, do one of these:
   - Remove the data before you send. In Photos, tap Share, tap **Options** at the top, and turn off **Location**. Do not change the Shortcut's Convert Image step (Preserve Metadata off, decision 36).
   - Or do not use the Shortcut. In GTG, open the gallery and tap **Add photos**. You can select many photos at once. GTG removes the location and the other data before the upload.

## 9. Shared change in the editor

Now the add-photo logic is inside the `#photo-files` change handler ([editor.js:729](../../../app/js/screens/editor.js)). Move it into one function, `addPhotoFiles(files, { origins })`, that takes `File` or `Blob` objects. Three callers use it:

1. The Add photos button (no change in behavior).
2. The Android share screen.
3. The inbox (with `origins` for each file, section 8.4).

The editor gets the incoming photos by one route, for example `#/edit/<siteId>/<path>?incoming=<key>`. The `incoming` key points to the files in `gtg-share` or to the inbox list. The builder chooses the exact form.

## 10. Decisions

The owner approved 32–38 on 2026-10-25. 38 replaces a purge path that the owner refused. They are in `docs/decisions.md`.

| # | Decision |
|---|---|
| 32 | Android: GTG is a share target for images (`share_target` in the manifest). |
| 33 | iPhone: an Apple Shortcut is the share path, because iOS does not support `share_target`. |
| 34 | The iPhone inbox is the folder `gtg-inbox/` on the branch `gtg-inbox`, one shared inbox for each site. GTG deletes the branch when the inbox is empty. |
| 35 | The users of a site can share one token. The Shortcut keeps its own copy of that token. |
| 36 | The Shortcut converts each photo to JPEG without metadata, at most 1600 px wide, before the upload. |
| 37 | Each waiting photo has a Discard button that deletes it from the inbox. |
| 38 | GTG does not check inbox files and offers no purge. The Shortcut help page warns iPhone users: a shared photo stays in the repository history, so for a public repository, remove the location before sending, or use Add photos in GTG. |

## 11. Calls made by Claude (not by the owner)

- Branch name `gtg-inbox`, and folder `gtg-inbox/` on it.
- "N photos waiting" goes on the site screen.
- Cache API, not IndexedDB, for Android shared files.
- Delete the branch only when the whole inbox is empty. No branch rebuild.
- The two race cases in 8.4 are documented, not fixed.
- The Shortcut resizes to 1600 px, the same as the app.
- A cleanup list on the device, so a published photo does not show as waiting again after the app closes during cleanup.
- A photo removed from the gallery before Publish goes back to waiting. It is not discarded.

## 12. Left to the builder

- The layout of the Share screen and the "N photos waiting" row (follow `docs/design.md`).
- The exact route form for incoming photos.
- The text of the help page and the Shortcut recipe.
- Tests: the pure parts (inbox file names, the share-target request handling, the cleanup order) get unit tests, as the project does now.

## 13. Test on a device

- Android Chrome, installed GTG: share 1 and 5 photos from Photos. Check that the CSP `form-action 'none'` does not block the share POST.
- iPhone (owner, borrowed phone): share 1 and 5 photos with the Shortcut. Check JPEG, no GPS, size.
- Discard a waiting photo. Check that it leaves the inbox.
- Read the Shortcut help page on the phone. Check that the warning (8.5) is near the top and is easy to see.
- Close the app right after Publish of inbox photos. Open it again. Check that the photos do not show as waiting.
- Two phones on one site: share at the same time. Check that both sets arrive.
- Add the inbox photos on Android. Check that the branch is deleted.
- Offline: the site screen shows no error.
