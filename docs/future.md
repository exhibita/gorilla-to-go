# Future work

Future work is tracked in GitHub issues, not in this file:

- **Gorilla To Go:** https://github.com/exhibita/gorilla-to-go/issues
- **Vanilla Gorilla (the template):** https://github.com/exhibita/vanilla-gorilla/issues

## Labels in Gorilla To Go

| Label | Meaning |
|---|---|
| `bug` | Something does not work as it should. |
| `enhancement` | A new feature or a change that is ready to plan. |
| `idea` | A feature that needs a decision before work starts. |
| `testing` | A test to run, on a device or by hand. |

## How to use them

1. Open an issue for each problem or idea, with the background and a "Done when" checklist.
2. In the PR that does the work, write `Closes #<number>` in the description. The issue closes when the PR is merged.
3. When an `idea` gets a decision, change its label to `enhancement`, or close it with the reason.

## Vanilla Gorilla issues that GTG users will see

- [vanilla-gorilla#5](https://github.com/exhibita/vanilla-gorilla/issues/5): commit `config.json`, so the RSS feed and sitemap use the site's own address.
- [vanilla-gorilla#6](https://github.com/exhibita/vanilla-gorilla/issues/6): keep a hand-built `/gallery/` page when the site also has Markdown galleries. Until then, adding a gallery in GTG replaces such a page (for example the hartisan.hair portfolio).
- [vanilla-gorilla#7](https://github.com/exhibita/vanilla-gorilla/issues/7): a lightbox for images in blog posts. GTG needs no change.
