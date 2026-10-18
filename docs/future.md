# Future versions (after the MVP)

- **Guided onboarding** for non-technical users in the installed PWA: create a GitHub account, sign in and create the base site. Include install instructions for iPhone.
- **GitHub sign-in (OAuth)** to replace personal access tokens. This needs a small server for the token exchange.
- **Template upgrades from the app:** the app commits the new template files to a site. If an upgrade changes `.github/workflows/`, the token needs the Workflows (read and write) permission.
- **Links page support:** a list editor for the `links:` frontmatter. Reuse the gallery list-editing code.
- **CodeMirror 6** editor, if the textarea is not enough.
- **Image cleanup:** remove images that no page uses.
- **Lightbox for blog post images** (a Vanilla Gorilla template change, not a GTG change): when a blog post has two or more images, `build.js` makes each image open a large view with previous and next, as the gallery does. Use the same CSS-only lightbox (`:target`), with IDs that do not clash with the gallery (`#img1`). GTG needs no change: it writes plain Markdown images. Decide whether a post with one image also gets the large view.
- **AI assist:** for example, "draft this post for me".
