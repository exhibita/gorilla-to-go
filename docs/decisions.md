# Decision log

All decisions were made on 2026-10-17 unless a different date is shown.

| # | Decision |
|---|---|
| 1 | Build the app as a progressive web app (PWA). |
| 2 | Use vanilla HTML, CSS and JavaScript. No framework. |
| 3 | Image handling is part of the MVP. |
| 4 | Start the editor as a plain textarea with a custom toolbar. CodeMirror 6 can replace the textarea later. |
| 5 | Sign in with a fine-grained personal access token now. Add GitHub sign-in (OAuth) later. |
| 6 | Changes to the Vanilla Gorilla template (`build.js` and skeletons) are allowed. |
| 7 | The MVP must manage many sites. |
| 8 | Sites must run the required Vanilla Gorilla template version to use the app. Existing sites will be upgraded. |
| 9 | Store the template version in `package.json` (`"vanillaGorilla": { "templateVersion": 2 }`), not in `config.json`. |
| 10 | The Link Tree page type is renamed **Links**. Its label is **Links page**. The links are stored as a list in frontmatter. App support comes after the MVP (added in 0.14.0 on 2026-10-21, decisions 27–30). |
| 11 | Light and dark themes. The default follows the device. The user can change it with a toggle. |
| 12 | The light theme uses the vg.exhibita.com colors. |
| 13 | Show a welcome screen until the user adds the first site. |
| 14 | The app name is **Gorilla To Go**, short name **GTG**. |
| 15 | The "Add a site" checks run automatically after the token is entered. |
| 16 | The token instructions and the template upgrade instructions are pages inside the PWA. They must work offline. |
| 17 | License: AGPL-3.0 (changed from GPL-3.0 on 2026-10-17). |
| 18 | GTG is hosted at gorillatogo.app (changed from gtg.exhibita.com on 2026-10-18). |
| 19 | GTG uses semantic versioning (MAJOR.MINOR.PATCH), starting at 0.1.0. |
| 20 | Local development uses a dev server (for example Vite) and ngrok for HTTPS on the phone. |
| 21 | Each entry in the gallery `images:` list has the fields `path`, `alt` and `caption`. `path` starts with `./` and is relative to `src/`, for example `./images/gallery/<slug>/photo.jpg`. GTG writes `./images/...` paths in Markdown text too. |
| 22 | A page is a draft when its frontmatter has `draft: true`. The string `"true"` (any case) is also a draft. GTG writes the boolean `true`. |
| 23 | The GTG test site is the GitHub repository `exhibita/gtg-test-site`, deployed with GitHub Pages. |
| 24 | The repository `exhibita/gorilla-to-go` is public. A GitHub Actions workflow deploys the `app/` folder to GitHub Pages on each push to `main` (decision 18, `docs/hosting.md`). |
| 25 | The editor Preview uses a copy of `marked` (MIT), the Markdown renderer that `build.js` uses, kept inside the app and served from the app itself, so the preview renders the same as the site. Use the version the template uses (18.0.6 on 2026-10-18), and update it when the template changes. |
| 26 | A new page is committed only when the user taps Publish, not when it is created. Until then it is kept on the device and shows as "Not published" in the Pages list. Reason: each commit to `main` deploys the site, so an empty page must not go live. Publish creates the file without a SHA, so GitHub refuses it when the file exists. This changes "Add … commits it" in mvp-plan section 5. |
| 27 | (2026-10-21) Links pages need Vanilla Gorilla template version 3. The required version for the app stays 2: a site on version 2 keeps working, but GTG offers the Links page type only when the site's `templateVersion` is 3 or higher. Otherwise the New page screen links to the upgrade page. |
| 28 | (2026-10-21) GTG makes a new links page at `src/<slug>/index.md`, as a page. A page with `skeleton: links` is a links page at any path, as `build.js` reads it. |
| 29 | (2026-10-21) GTG edits these keys of a links page: `title`, `description`, `draft`, the `links:` list (`url` and `text`), the picture (`image`, `image_alt`), `sitemap` and the page `css`. |
| 30 | (2026-10-21) A link address must be a full URL with `http:`, `https:`, `mailto:`, `tel:` or `sms:`, as in `build.js`. GTG does not add `https://`: the user types the full address. |
| 31 | (2026-10-22) The editor Preview shows the look of the site, not the app theme, for all page types. GTG reads the colours, fonts and radius from the site's `src/css/style.css` (the rules for `body`, `h1`, `a`, `.link-button` and `.btn-primary` first, then the token names, then the template look) and keeps them on the site record. The app cannot load the site stylesheet or its web fonts (CSP), so a font that the app does not have falls back to the next font in the site's list. The `css:` of a links page does not show. |
| 32 | (2026-10-25) Android: GTG is a share target for images (`share_target` in the manifest). Design: `docs/superpowers/specs/2026-10-25-share-to-gallery-design.md`. |
| 33 | (2026-10-25) iPhone: an Apple Shortcut is the share path, because iOS does not support `share_target`. |
| 34 | (2026-10-25) The iPhone inbox is the folder `gtg-inbox/` on the branch `gtg-inbox`, one shared inbox for each site. GTG deletes the branch when the inbox is empty. |
| 35 | (2026-10-25) The users of a site can share one token. The Shortcut keeps its own copy of that token. |
| 36 | (2026-10-25) The Shortcut converts each photo to JPEG without metadata, at most 1600 px wide, before the upload. |
| 37 | (2026-10-25) Each waiting photo has a Discard button that deletes it from the inbox. |
| 38 | (2026-10-25) GTG does not check inbox files and offers no purge. The Shortcut help page warns iPhone users: a shared photo stays in the repository history, so for a public repository, remove the location before sending, or use Add photos in GTG. |

## Notes

- **License change:** while you are the only copyright holder, you can change the license from GPL-3.0 to AGPL-3.0. If other people contribute code, you need their agreement first, for example with a contributor license agreement (CLA).
- **Test site:** GTG commits to real GitHub repositories, and each commit to `main` deploys. Use a separate test site during development (decision 23).

