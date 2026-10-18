# MVP plan

## 1. Architecture

- Vanilla HTML, CSS and JavaScript (ES modules). No framework.
- A service worker caches the app. A web app manifest makes the app installable.
- IndexedDB stores site settings, tokens and unsaved drafts.
- The app calls the GitHub REST API directly from the browser. No server is necessary.
- The app is hosted on GitHub Pages.

## 2. Sign-in (personal access token)

- Each site uses a fine-grained personal access token with access to that site's repository only.
- Required permissions: Contents (read and write) and Actions (read).
- The app tests the token when the user adds a site.
- A token gives write access to the repository. Use a strict Content Security Policy and no third-party scripts.
- The sign-in code is one module, so GitHub sign-in can replace it later.

## 3. Template changes (Vanilla Gorilla template version 2)

- **Drafts:** the build skips a page that has `draft: true` in its frontmatter. Drafts are saved in GitHub, not only on the phone.
- **Galleries:** an `images:` list in the frontmatter, with a path, alt text and caption for each image. The gallery skeleton makes the grid and the lightbox from this list.
- **Version marker:** `"vanillaGorilla": { "templateVersion": 2 }` in `package.json`.
- **License:** we need to add `"license": "AGPL-3.0-or-later"` in `package.json`.

## 4. Version check

- The app reads the template version when the user adds a site.
- If the version is too old, the app does not add the site. It shows the required version and a link to the upgrade instructions.
- The app checks the version again each time it opens a site.

### Upgrade of existing sites

1. Make the template changes in the main vanilla-gorilla repository.
2. Write a short upgrade guide that lists the changed files.
3. Apply the changes to each existing site.
4. Make sure each site builds and deploys correctly.

## 5. Page operations

| Operation | What the app does |
|---|---|
| Add | Makes a slug from the title, writes `index.md` with frontmatter (`title`, `date`, `description`, `skeleton`) and commits it when the user taps Publish (decision 26). |
| Edit | Reads the file and its SHA, changes it and commits the change. |
| Delete | Deletes the file. The next build updates the index pages, RSS feed and sitemap. |

Rules:

- Show only Markdown pages. Do not show hand-built HTML pages, `templates/` or `skeletons/`.
- The slug cannot change after the page is created. A changed slug breaks links and RSS.
- Do not overwrite a page that already exists.
- Ask for confirmation before a delete.

## 6. Screens

1. **Welcome:** shown when there are no sites. Logo, name, version, "Add a site" and a link to the token instructions.
2. **Add a site:** repository, branch, name in the app, token, and the checks.
3. **Pages:** the pages of one site, with filters for blog posts, pages and galleries.
4. **New page:** title, type, slug and description.
5. **Editor:** Write/Preview toggle, toolbar above the keyboard, and a panel for the frontmatter fields.
6. **Gallery:** a grid of images. Add, reorder and remove images, and edit alt text.
7. **Publish status:** "Publishing", "Live" or "Build failed", from the GitHub Actions run.

## 7. Image handling

- The app reduces each photo to a maximum width of 1600 px before upload.
- Images go in `src/images/<type>/<slug>/`.
- The app commits a page and its images together in one commit (Git Data API). This starts only one deploy.
- The app inserts `![alt](path)` at the cursor.

## 8. Build order

1. Change the template and test it on one site.
2. Build the app shell, the Add a site screen and the token test.
3. Show the page list and open pages for reading.
4. Add editing and saving with a plain textarea.
5. Add page creation.
6. Add page deletion with a confirmation step.
7. Add image upload.
8. Add the gallery screen.
9. Add drafts and publish status.
10. Optional: replace the textarea with CodeMirror 6.

Step 1 is done (2026-10-17): template version 2 is merged, and the test site is `exhibita/gtg-test-site`.

Template version 2.1 is done (2026-10-18, vanilla-gorilla#4). The build skips a page with front matter that is not valid YAML and shows a warning, so one bad page no longer stops the deploy. It also fixes the minor findings from the version 2 review. The test site runs version 2.1.

### Before go-live

- **Install as app:** an "Install as app" link in the app opens a help page inside the PWA (it must work offline, as decision 16 says for the other help pages). The text comes from `docs/install-app.md` and its images from `docs/img/install/`. The user is still editing these files. Keep them out of commits until the user says the guide is ready.

## 9. Risks

- **Edit conflicts:** a page can change on GitHub during an edit. The app must find this and stop, so it does not overwrite the other change.
- **iOS storage:** iOS can delete local data. Save drafts to GitHub often.
- **iOS install:** iOS has no install prompt. The user must tap Share, then Add to Home Screen.
- **No background work on iOS:** the app must stay open until a commit is complete.
- **Invalid front matter:** with template version 2.1, the build skips a page with front matter that is not valid YAML, so that page is not published. The app must always write valid YAML and put text values in quotes.
