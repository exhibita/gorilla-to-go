# Security policy

Gorilla To Go (GTG) is a progressive web app that commits to your GitHub repositories with a token that you give it. The token stays on your device. The app has no server. This policy says how to report a security problem and what you can expect from us.

## Report a security problem

Do not open a public issue for a security problem.

Use one of these channels:

1. **GitHub private vulnerability reporting (preferred):** open <https://github.com/exhibita/gorilla-to-go/security/advisories/new> and fill in the form. Only the maintainers see the report.
2. **Email:** <security-reporting@exhibita.com>. 

Put this information in the report:

- The version of the app. Open the About screen in the app, or the "What is new" page. The version is also in `app/js/version.js`.
- The browser and the operating system, for example "Safari, iOS 19".
- Steps to reproduce the problem. A short proof of concept helps most.
- The impact, as you see it. For example: "a page in a shared repository can read the token".

You can write in English.

## What happens next

| Step | Target time |
|---|---|
| We confirm that we received the report | 4 business days |
| We tell you if the report is in scope, and how serious we think it is | 7 business days |
| We publish a fix for a confirmed problem | 90 days at the latest; critical problems much sooner |

We keep you informed while we work on the fix. We publish fixes in the changelog and, for confirmed vulnerabilities, as a GitHub Security Advisory. If you want it, we name you in the advisory.

GTG is a web app. When a fix is published, every user gets it the next time the app opens with a connection. There is nothing to install.

## Supported versions

GTG runs from one address: <https://gorillatogo.app>. Only the version that is live at that address is supported. We do not fix older versions.

## Scope

**In scope**

- The app at <https://gorillatogo.app>: all code in `app/`.
- The way the app stores and uses GitHub tokens.
- The editor Preview sanitizer (`app/js/sanitize.js`) and all places where repository content is shown.
- The service worker and the offline cache.
- The deploy workflow in `.github/workflows/`.

**Out of scope**

- Copies of GTG that other people deploy at other addresses. Report those to the people who run them.
- The Vanilla Gorilla template and the sites that it builds. Report those at <https://github.com/exhibita/vanilla-gorilla>.
- GitHub itself (github.com, api.github.com, GitHub Pages, GitHub Actions). Report those to GitHub.
- Problems that need a device, a browser or a GitHub account that is already compromised.
- Problems that need a user to paste their token into another website or app.
- Reports from automated scanners without a working proof of concept.
- Denial of service against GitHub's API with a user's own token.
- Missing HTTP response headers that GitHub Pages cannot set (for example `Strict-Transport-Security`, `X-Frame-Options`). The app uses a `<meta>` Content Security Policy and a script that refuses to run in a frame instead.

## Known and accepted risks

These are design decisions. You do not need to report them.

- The token is stored on the device in IndexedDB, in plain text. The device encryption and the browser profile are the boundary. Encrypting it with a key that is stored in the same place adds no protection.
- The app has no lock screen. A person who holds the unlocked phone can publish or delete pages.
- A fine-grained token that is removed from the app is not revoked on GitHub. The app tells the user to delete it on GitHub.

## Rules for testing

We welcome good-faith research. Keep to these rules, and we will not take legal action against you and will not report you to GitHub:

- Test only with your own GitHub account, your own repositories and your own tokens. GTG makes real commits. Never test against a repository that is not yours.
- Do not read, change or delete data that is not yours.
- Do not run automated traffic against GitHub's API.
- Give us the time in the table above before you publish anything.

## For users: if you think your token is exposed

1. Open <https://github.com/settings/personal-access-tokens> on GitHub.
2. Delete the token.
3. Make a new token. The app has a help page: **Add a site > How to create a token**.
4. Remove the site in the app, and add it again with the new token.

## Version of this policy

This policy was last changed on 2026-10-21.
