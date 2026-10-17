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

## Open questions

- Run the "Add a site" checks automatically after the token is pasted, or only when the user taps a "Test" button? Recommendation: automatically.
- Write the token instructions page and the template upgrade page. Proposed location: vg.exhibita.com, for example `/docs/github-token/`.
