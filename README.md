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

The app is plain HTML, CSS and JavaScript in `app/`. There is no build step. You need Node.js 22 or later.

1. Run `npm run dev`.
2. Open http://localhost:5173/.

To run the tests, run `npm test`.

To test on a phone, the app needs HTTPS:

1. Run `npm run dev`.
2. In a second terminal, run `ngrok http 5173`.
3. On the phone, open the HTTPS address that ngrok shows.

Only the `app/` folder is published. GitHub Pages hosts it at https://gorillatogo.app. See [docs/hosting.md](docs/hosting.md).

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
