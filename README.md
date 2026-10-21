# Gorilla To Go (GTG)

Gorilla To Go is a progressive web app (PWA) for managing [Vanilla Gorilla](https://github.com/exhibita/vanilla-gorilla) static sites from a phone.

With GTG you can:

- Add a page to a site: a blog post, a page or a gallery.
- Edit a page in a mobile Markdown editor.
- Delete a page.
- Add and manage images.
- Manage more than one site.

GTG does not build the site. It commits Markdown files and images to the site's GitHub repository. The site's GitHub Actions workflow builds and deploys the site.

## Development

The app is plain HTML, CSS and JavaScript in `app/`. There is no build step. You need Node.js 24.15 or later (or 22.22 or later) for the dev server and the tests. The tests use jsdom, which sets this requirement.

1. Run `npm run dev`.
2. Open http://localhost:5173/.

To run the tests, run `npm install` one time, then `npm test`. The app has no dependencies. The tests use one development dependency, [jsdom](https://github.com/jsdom/jsdom), to run the Preview sanitizer in a document (`test/sanitize.test.js`).

To test on a phone, the app needs HTTPS:

1. Run `npm run dev`.
2. In a second terminal, run `ngrok http 5173`.
3. On the phone, open the HTTPS address that ngrok shows.

Only the `app/` folder is published. GitHub Pages hosts it at https://gorillatogo.app. See [docs/hosting.md](docs/hosting.md).

## Release a new version

Each release has a new version number and a changelog entry.

1. Change the version in `package.json`, `app/js/version.js` and `app/sw.js` (`VERSION`). The three must be the same.
2. Add an entry at the top of [CHANGELOG.md](CHANGELOG.md): `## <version> — <YYYY-MM-DD>`, then short items for the user.
3. Run `npm run changelog`.
4. Run `npm test`.
5. Commit `CHANGELOG.md` and `app/js/changelog-recent.js` together.

> **Reminder:** do step 3 each time you change `CHANGELOG.md` by hand, also for a small fix in an older entry. The script copies the last 3 entries into `app/js/changelog-recent.js`. The app shows that copy on the "What is new" page when the phone is offline. Nothing runs the script automatically. If you forget it, `npm test` fails, and the GitHub Actions deploy stops before it publishes the app.

## Documents

| File | Contents |
|---|---|
| [docs/mvp-plan.md](docs/mvp-plan.md) | The MVP plan: architecture, screens and build order |
| [docs/decisions.md](docs/decisions.md) | The decision log |
| [docs/design.md](docs/design.md) | Themes, colors, typography and screen designs |
| [docs/vanilla-gorilla-notes.md](docs/vanilla-gorilla-notes.md) | How Vanilla Gorilla works, and what GTG depends on |
| [docs/hosting.md](docs/hosting.md) | How GitHub Pages hosts GTG, and how to set up the domain |
| [docs/future.md](docs/future.md) | Features for versions after the MVP |
| [docs/name-research.md](docs/name-research.md) | Name candidates and the name checks |
