# Vanilla Gorilla notes

Source: https://github.com/exhibita/vanilla-gorilla (read on 2026-10-16).

## How pages are stored

Each page is a Markdown file with frontmatter.

| Type | Path | Frontmatter |
|---|---|---|
| Blog post | `src/blog/<slug>/index.md` | `blog` is the default skeleton |
| Gallery | `src/gallery/<slug>/index.md` | The build requires exactly this depth |
| Page | `src/<slug>/index.md` | `skeleton: page` |
| Links page | Any path. GTG makes `src/<slug>/index.md` | `skeleton: links` and a `links:` list (template version 3) |

Common frontmatter fields: `title`, `date`, `description`, `skeleton`.

## Links pages (template version 3)

Source: `docs/UPGRADE-v3.md` and `build.js` (`isLinksPage`, `linkItems`, `renderLinks`), read on 2026-10-21.

- A page with `skeleton: links` is a links page at any path. The build compares the exact text `links`. A links page is never in the blog index, the gallery index or the RSS feed.
- Each entry of `links:` has `url` and `text`. The build skips an entry without them, an address that is not a full URL, and a protocol other than `http:`, `https:`, `mailto:`, `tel:` and `sms:`. It shows a warning only; the deploy does not stop.
- Other keys: `image` (a picture above the title: a `./images/...` path or a full URL), `image_alt`, `css` (CSS for this page only, as a `|` block), `sitemap` (the page is in `sitemap.xml` only with `true`), `draft`, `description`. The links skeleton shows no date.
- A site on template version 2 has no links skeleton, so the build skips the page with a warning. GTG offers links pages only on version 3 (decision 27).
- The template has a draft sample page, `src/links/index.md`.

## Build and deploy

- `build.js` compiles Markdown and templates into `index.html` files with directory-style URLs.
- The blog and gallery index pages, the RSS feed and the sitemap are made during the build.
- A GitHub Actions workflow builds and deploys the site on each push to `main`.
- `create-page.js` refuses to overwrite an existing page.
- `config.json` is committed (vanilla-gorilla#14). It has `_comment`, `siteUrl`, `siteTitle` and `siteDescription`, and some sites also have `distributionId` and `awsProfile` for `invalidate.js`. The RSS feed and the sitemap use the three site values. `SITE_URL`, `SITE_TITLE` and `SITE_DESCRIPTION` environment variables win over the file. GTG edits the three site values in the site sheet (decision 39).

## Things to watch

- Some pages are hand-built HTML (for example `index.html` and the gallery index). Do not edit them in the app.
- The gallery skeleton uses a CSS-only lightbox with hand-written anchors (`#img1`). Plain Markdown images probably do not get the lightbox. Template version 2 fixes this with an `images:` frontmatter list.
- Deleting a page does not delete its images.
- The repository has agent skills in `.agents/skills` (page-creator, design-apply).
- Colors and fonts are in `src/css/style.css`.
