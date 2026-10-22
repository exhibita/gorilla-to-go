// The last 3 entries of CHANGELOG.md, for the "What is new" page when the app is offline.
// Do not edit by hand: run npm run changelog (a test checks that this is the same as CHANGELOG.md).
export const RECENT_CHANGES = `## 0.15.0 — 2026-10-22

- The Preview shows your page in the colours and fonts of your site, also when the app uses the dark theme. This works for blog posts, pages, galleries and links pages.
- The Preview shows the title of the page at the top, as on the site.
- The app reads the look from the site's style.css the first time you open Preview, and keeps it on the device for offline use.
- A font that the app does not have shows as the next font in your site's font list.

## 0.14.0 — 2026-10-21

- Links pages: a page of link buttons, for example for a social media profile. The site needs Vanilla Gorilla template version 3.
- In the editor, the Links view has the picture above the title and the list of links. Tap a link to change its text, its address or its place.
- The app checks each address as the site does. Type the full address, with https:// at the start, or use mailto:, tel: or sms:.
- Details of a links page has a sitemap switch and a field for the CSS of the page.
- The upgrade page has the steps for template version 3.

## 0.13.0 — 2026-10-21

- Security review of the app. The app now refuses to run inside another website's page.
- Add a site: the app tells you when the branch name is not a name that git accepts.
- Remove a site: the dialog tells you that the token still works on GitHub, and where to delete it.
- The project has a security policy. SECURITY.md on GitHub says how to report a security problem.`;
