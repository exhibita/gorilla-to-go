# Step 9: Drafts and Publish Status — Implementation Plan

> Executed inline (superpowers:executing-plans). The user asked for best judgement and tests after the build.

**Goal:** Save a page as a draft on GitHub, so that the site does not show it yet. After each publish, show whether the site build is running, is live, or failed.

**Spec:** `docs/mvp-plan.md` section 3 ("Drafts: the build skips a page that has `draft: true`. Drafts are saved in GitHub, not only on the phone"), section 6 screen 7 ("Publish status: Publishing, Live or Build failed, from the GitHub Actions run"), section 8 step 9, section 9 ("iOS storage: save drafts to GitHub often"); decision 22 (`draft: true`; the string "true" in any case is also a draft; GTG writes the boolean); section 2 (the token has Actions read access; the Add a site check tests it).

## Global Constraints

- **Draft switch** in the Details sheet: "Draft. The site does not show a draft. It is saved on GitHub." On: the front matter gets `draft: true` (the boolean, decision 22). Off: the app removes the `draft` key. The line changes only when the state changes; `draft: "TRUE"` stays as it is while the page stays a draft.
- With the switch on, the Publish button reads **Save draft**, and the result text says that the site does not show the page. The commit and the conflict rules are the same as Publish.
- The editor head shows a **Draft** label. The Pages list has a **Drafts** filter. The page view shows the Draft label (it uses the list labels).
- **Publish status** (mvp-plan screen 7) comes from the GitHub Actions runs of the commit: `GET /repos/{o}/{r}/actions/runs?branch=<branch>&head_sha=<sha>`. Only runs that build the site count: events `push`, `dynamic` (a Pages build) and `workflow_dispatch`.
  - No run yet: "Waiting for the build to start". No run after 3 minutes: "No build started. Check Actions on GitHub."
  - A run that is queued or running: **Publishing**.
  - All runs completed with success (or skipped or neutral): **Live**.
  - A run that failed (failure, timed out, startup failure, action required): **Build failed**, with a link to the run on GitHub.
  - A cancelled run (for example a newer publish replaced it): "The build stopped. A newer publish can replace it."
- **Where it shows:**
  - In the editor, after Publish or Save draft. The status updates until the build ends.
  - On the Pages list, in one line under the title: the state of the newest build on the branch. After a publish or a delete from this device, the line follows that commit.
- Polling: every 5 seconds in the first minute, then every 10 seconds. Without a connection, or after an error, every 30 seconds. It stops when the build ends, without Actions access, after 20 minutes, or when the screen closes. One request for each poll.
- When the commit SHA is not known (a save that the app found after a time-out), the editor shows no status line and says that the site updates in a few minutes.
- `saveFile`, `commitFiles` and `deleteFile` return the commit SHA when GitHub gives it.
- Same rules as before: CSP, STE100, 44 px, token only through `auth.js`. Version 0.9.0.

## Review Focus

1. **Draft line changes** — on/off changes only the `draft` line; a page that does not change state keeps its bytes. Tests: `setDraft`.
2. **Run states** — several runs for one commit, a cancelled run, no run, a run for an older commit. Tests: `buildState`.
3. **Polling stops** — when the screen closes, the build ends, or the time limit passes; no requests after that.
4. **Token without Actions access** — a 403 or 404 shows "The app cannot read the build status" once, and the polling stops.

## Tasks

1. `app/js/frontmatter-write.js` (TDD): `setDraft(raw, draft)`.
2. `app/js/build-status.js` (TDD for the rules): `buildState(runs, { sha, elapsedMs })`, `buildStatusText(state)`, `watchBuild(...)`; `app/js/github.js` (TDD): `listBuildRuns(...)`; commit SHAs from the saves and the delete.
3. `app/js/pages-logic.js` (TDD): the Drafts filter.
4. Editor: the Draft switch, the label, Save draft, and the build status after a save. Pages list: the build status line.
5. Version 0.9.0, browser check, whole-branch review, PR.

## User verification (live, on gtg-test-site)

1. Open a blog post, tap Details, turn on Draft, tap Apply, then Save draft. GitHub has `draft: true` in the page. The status goes from "Publishing" to "Live". After the build the post is not on the site (and not in the blog index or the RSS feed).
2. Turn Draft off and tap Publish. The post is back on the site.
3. On the Pages list, the status line shows "Publishing", then "Live".
4. Optional: make the build fail (for example a commit on github.com that breaks `package.json`), then publish from the app: the status shows "Build failed" with a link to the run. Undo the change after the test.
