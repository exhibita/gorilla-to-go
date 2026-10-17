# Vanilla Gorilla notes

Source: https://github.com/exhibita/vanilla-gorilla (read on 2026-10-16).

## How pages are stored

Each page is a Markdown file with frontmatter.

| Type | Path | Frontmatter |
|---|---|---|
| Blog post | `src/blog/<slug>/index.md` | `blog` is the default skeleton |
| Gallery | `src/gallery/<slug>/index.md` | The build requires exactly this depth |
| Page | `src/<slug>/index.md` | `skeleton: page` |
| Links (future) | to be decided | `links:` list |

Common frontmatter fields: `title`, `date`, `description`, `skeleton`.

## Build and deploy

- `build.js` compiles Markdown and templates into `index.html` files with directory-style URLs.
- The blog and gallery index pages, the RSS feed and the sitemap are made during the build.
- A GitHub Actions workflow builds and deploys the site on each push to `main`.
- `create-page.js` refuses to overwrite an existing page.
- The repository has `config.example.json`, so `config.json` is probably not committed. Do not store data that the app must read in `config.json`.

## Things to watch

- Some pages are hand-built HTML (for example `index.html` and the gallery index). Do not edit them in the app.
- The gallery skeleton uses a CSS-only lightbox with hand-written anchors (`#img1`). Plain Markdown images probably do not get the lightbox. Template version 2 fixes this with an `images:` frontmatter list.
- Deleting a page does not delete its images.
- The repository has agent skills in `.agents/skills` (page-creator, design-apply).
- Colors and fonts are in `src/css/style.css`.
