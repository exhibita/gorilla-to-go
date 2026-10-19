# Install as App Page — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for this before go-live.

**Goal:** A help page inside the app that tells the user how to install Gorilla To Go on a phone, and links to it.

**Spec:** `docs/mvp-plan.md` "Before go-live" (an "Install as app" link opens a help page inside the PWA; content from `docs/install-app.md` and its images); decision 16 (help pages are inside the PWA and work offline); `docs/install-app.md` (the user's finished guide: "Install the app first. Then add your site.").

## Global Constraints

- Route `#/help/install`, title "Install the app". The page is HTML in `app/js/screens/help-install.js`, made from `docs/install-app.md`, as the token page is made from `docs/github-token.md`. No Markdown at runtime, no change to the CSP.
- The text stays as the user wrote it. Only these changes: the "Find your instructions" table becomes a list of buttons that scroll to the section (a `#` link would change the app route); "How to create a GitHub token" becomes a link to `#/help/token`; HTML comments (photo placeholders) are left out.
- **Images:** move `docs/img/install/` to `app/img/install/`, so there is one copy. `docs/install-app.md` points to `../app/img/install/...` (images and the photo placeholder notes). All images are in the service worker list, so the page works offline.
- **Links:**
  - Welcome screen, in a browser tab (not installed): a card "Install the app first" above "Add a site", with the link. The guide says to install first, because on an iPhone the browser and the installed app keep their data apart.
  - Welcome screen, in the installed app: no card.
  - About box: "How to install the app", always.
- Same rules as before: CSP, STE100, 44 px, no inline styles. Version 0.10.0.

## Tasks

1. Move the images; update the paths in `docs/install-app.md`.
2. `help-install.js` with the page HTML; route; Back to the screen before.
3. Welcome card and About link.
4. Tests: every image on the page exists and is in the service worker list; every jump button has its section.
5. Version 0.10.0, browser check (light, dark, 360 px, offline), PR.

## User verification

1. Open https://gorillatogo.app in a phone browser (not the installed app): the Welcome screen shows "Install the app first". Tap the link and read the page. Tap a row in "Find your instructions": the page scrolls to that section.
2. Open the installed app: the Welcome card does not show. The About box has "How to install the app".
3. Turn on airplane mode, open the installed app, open the page from About: the text and the images show.
