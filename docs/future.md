# Future versions (after the MVP)

- **Guided onboarding** for non-technical users in the installed PWA: create a GitHub account, sign in and create the base site. Include install instructions for iPhone.
- **GitHub sign-in (OAuth)** to replace personal access tokens. This needs a small server for the token exchange.
- **Template upgrades from the app:** the app commits the new template files to a site. If an upgrade changes `.github/workflows/`, the token needs the Workflows (read and write) permission.
- **Links page support:** a list editor for the `links:` frontmatter. Reuse the gallery list-editing code.
- **CodeMirror 6** editor, if the textarea is not enough.
- **Image cleanup:** remove images that no page uses.
- **AI assist:** for example, "draft this post for me".
