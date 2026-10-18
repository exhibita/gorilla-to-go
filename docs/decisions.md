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
| 10 | The Link Tree page type is renamed **Links**. Its label is **Links page**. The links are stored as a list in frontmatter. App support comes after the MVP. |
| 11 | Light and dark themes. The default follows the device. The user can change it with a toggle. |
| 12 | The light theme uses the vg.exhibita.com colors. |
| 13 | Show a welcome screen until the user adds the first site. |
| 14 | The app name is **Gorilla To Go**, short name **GTG**. |
| 15 | The "Add a site" checks run automatically after the token is entered. |
| 16 | The token instructions and the template upgrade instructions are pages inside the PWA. They must work offline. |
| 17 | License: AGPL-3.0 (changed from GPL-3.0 on 2026-10-17). |
| 18 | GTG is hosted at gtg.exhibita.com. |
| 19 | GTG uses semantic versioning (MAJOR.MINOR.PATCH), starting at 0.1.0. |
| 20 | Local development uses a dev server (for example Vite) and ngrok for HTTPS on the phone. |
| 21 | Each entry in the gallery `images:` list has the fields `path`, `alt` and `caption`. `path` starts with `./` and is relative to `src/`, for example `./images/gallery/<slug>/photo.jpg`. GTG writes `./images/...` paths in Markdown text too. |
| 22 | A page is a draft when its frontmatter has `draft: true`. The string `"true"` (any case) is also a draft. GTG writes the boolean `true`. |
| 23 | The GTG test site is the GitHub repository `exhibita/gtg-test-site`, deployed with GitHub Pages. |
| 24 | The repository `exhibita/gorilla-to-go` is public. A GitHub Actions workflow deploys the `app/` folder to GitHub Pages on each push to `main` (decision 18, `docs/hosting.md`). |
| 25 | The editor Preview uses a copy of `marked` (MIT), the Markdown renderer that `build.js` uses, kept inside the app and served from the app itself, so the preview renders the same as the site. Use the version the template uses (18.0.6 on 2026-10-18), and update it when the template changes. |

## Notes

- **License change:** while you are the only copyright holder, you can change the license from GPL-3.0 to AGPL-3.0. If other people contribute code, you need their agreement first, for example with a contributor license agreement (CLA).
- **Test site:** GTG commits to real GitHub repositories, and each commit to `main` deploys. Use a separate test site during development (decision 23).

