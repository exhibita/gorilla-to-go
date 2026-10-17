# CLAUDE.md

## Writing style

Explain things in the spirit of ASD STE100. Use direct sentence structures. Limit each procedural step to one action. Do not use unnecessary synonyms.

## Project

Gorilla To Go (GTG) is a PWA for managing Vanilla Gorilla static sites from a phone. Read these documents before you start work:

- `docs/mvp-plan.md`: the MVP plan
- `docs/decisions.md`: decisions already made. Do not change them without asking.
- `docs/design.md`: themes, colors and screens
- `docs/vanilla-gorilla-notes.md`: how Vanilla Gorilla stores and builds pages

## Technical rules

- Use vanilla HTML, CSS and JavaScript (ES modules). Do not use a framework.
- Do not load third-party scripts at runtime. The app stores GitHub tokens, so keep a strict Content Security Policy.
- Keep the sign-in code in one module. GitHub sign-in (OAuth) will replace the personal access token later.
- Keep all fonts and assets in the app, so the app works offline.
