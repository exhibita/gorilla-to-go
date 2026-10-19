// Publish status (mvp-plan section 6, screen 7): "Publishing", "Live" or "Build failed", from the
// GitHub Actions runs of a commit. The rules here have no network and no DOM, so they run in tests.
import { escapeHtml } from './dom.js';

// Runs that build the site: a push to the branch, a GitHub Pages build ("dynamic"), or a deploy
// started by hand. Other runs (pull requests, schedules) do not change the site.
const SITE_EVENTS = new Set(['push', 'dynamic', 'workflow_dispatch']);
// Conclusions of a good build, and of a failed build.
const GOOD = new Set(['success', 'skipped', 'neutral']);
const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
// A push starts its run some seconds later. After this time without a run, no build started.
const WAIT_FOR_RUN_MS = 3 * 60 * 1000;
// The app stops asking after this time.
const LIMIT_MS = 20 * 60 * 1000;
// After no connection or an error, the app asks again after this time.
const RETRY_MS = 30 * 1000;

// The state of the build of one commit (sha), or of the newest commit on the branch (no sha).
// runs: [{ sha, event, status, conclusion, url, createdAt, updatedAt }] from listBuildRuns.
// Returns { state, url?, updatedAt?, done }. state: waiting, publishing, live, failed, stopped or none.
export function buildState(runs, { sha, elapsedMs = 0 } = {}) {
    const siteRuns = runs.filter(run => !run.event || SITE_EVENTS.has(run.event));
    let relevant;
    if (sha) {
        relevant = siteRuns.filter(run => run.sha === sha);
    } else {
        const newest = [...siteRuns].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        relevant = newest ? siteRuns.filter(run => run.sha === newest.sha) : [];
    }
    if (relevant.length === 0) {
        return sha && elapsedMs < WAIT_FOR_RUN_MS ? { state: 'waiting', done: false } : { state: 'none', done: true };
    }
    const running = relevant.find(run => run.status !== 'completed');
    if (running) return { state: 'publishing', url: running.url, done: false };
    const updatedAt = relevant.map(run => run.updatedAt).filter(Boolean).map(String).sort().at(-1);
    const failed = relevant.find(run => FAILED.has(run.conclusion));
    if (failed) return { state: 'failed', url: failed.url, updatedAt, done: true };
    // Cancelled, stale, or no conclusion: the build did not finish.
    const stopped = relevant.find(run => !GOOD.has(run.conclusion));
    if (stopped) return { state: 'stopped', url: stopped.url, updatedAt, done: true };
    return { state: 'live', url: relevant[0].url, updatedAt, done: true };
}

const TEXTS = {
    waiting: ['Publishing', 'Waiting for the site build to start.'],
    publishing: ['Publishing', 'The site build is running.'],
    live: ['Live', 'The site shows the changes.'],
    failed: ['Build failed', 'The site build failed. The site still shows the last good version.'],
    stopped: ['Stopped', 'The site build stopped. A newer publish can replace it.'],
    none: ['No build', 'No site build started. Check Actions on GitHub.'],
    tooLong: ['Publishing', 'The site build takes a long time. Check Actions on GitHub.'],
    noAccess: ['Not known', 'The app cannot read the build status. The token needs the Actions (read) permission, and Actions must be on for the repository.'],
    offline: ['Not known', 'No connection. The app tries again soon.'],
    error: ['Not known', 'The app cannot read the build status now. The app tries again soon.']
};

// { label, sentence } for a status: a short label for a chip, and a sentence. draft: the save made
// the page a draft, so "the site shows the changes" is not true for this page.
export function buildStatusText({ state }, { draft = false } = {}) {
    const [label, sentence] = TEXTS[state] ?? TEXTS.error;
    if (state === 'live' && draft) return { label, sentence: 'The build is complete. The site does not show this draft.' };
    return { label, sentence };
}

// The status line as HTML: a label chip, the sentence, and a link to the run on GitHub when it helps.
// time (optional) is shown after a Live label, for example "3:04 PM".
export function buildStatusHtml(status, { time = '', draft = false } = {}) {
    const { label, sentence } = buildStatusText(status, { draft });
    const busy = status.state === 'waiting' || status.state === 'publishing';
    const linkStates = new Set(['publishing', 'failed', 'stopped', 'tooLong']);
    const url = typeof status.url === 'string' && status.url.startsWith('https://github.com/') ? status.url : '';
    const link = url && linkStates.has(status.state)
        ? ` <a class="text-link text-link--inline" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open the build on GitHub</a>`
        : '';
    const when = status.state === 'live' && time ? ` Last build: ${escapeHtml(time)}.` : '';
    return `<span class="build-chip build-chip--${escapeHtml(status.state)}">${busy ? '<span class="spinner spinner--small" aria-hidden="true"></span>' : ''}${escapeHtml(label)}</span> <span>${escapeHtml(sentence)}${when}</span>${link}`;
}

// Put the status line in the element only when it changed, so a screen reader does not read the same
// text again.
export function showBuildStatus(element, html) {
    if (element.dataset.html === html) return;
    element.dataset.html = html;
    element.innerHTML = html;
}

// The last commit that this device made on each site, so the Pages list follows its build even
// before GitHub starts the run. Kept in memory only: after an app restart the list shows the newest build.
const recentCommits = new Map();
const RECENT_MS = LIMIT_MS;

export function rememberCommit(siteId, sha, now = Date.now()) {
    if (sha) recentCommits.set(siteId, { sha, at: now });
}

export function recentCommit(siteId, now = Date.now()) {
    const recent = recentCommits.get(siteId);
    return recent && now - recent.at < RECENT_MS ? recent.sha : null;
}

// Wait ms, or less when the signal stops the wait.
function sleepFor(ms, signal) {
    return new Promise(resolve => {
        const done = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', done);
            resolve();
        };
        const timer = setTimeout(done, ms);
        signal?.addEventListener('abort', done, { once: true });
    });
}

// Ask for the runs until the build ends: every 5 seconds in the first minute, then every 10 seconds.
// list() gives the runs (it throws an error with noAccess or offline). onChange(status) is called when
// the state changes. Without a connection, or after an error, the app asks again after RETRY_MS.
// Stops when the build ends, without Actions access, after LIMIT_MS, or when the signal stops it.
export async function watchBuild({ list, sha, onChange, signal, sleep = sleepFor, now = Date.now }) {
    const start = now();
    let last = null;
    while (!signal?.aborted) {
        let status;
        try {
            status = buildState(await list(), { sha, elapsedMs: now() - start });
        } catch (err) {
            if (signal?.aborted) return;
            status = err.noAccess ? { state: 'noAccess', done: true } : { state: err.offline ? 'offline' : 'error', done: false, retry: true };
        }
        if (signal?.aborted) return;
        if (status.state !== last?.state || status.url !== last?.url) onChange(status);
        last = status;
        if (status.done) return;
        const elapsed = now() - start;
        if (elapsed >= LIMIT_MS) {
            onChange({ state: 'tooLong', url: status.url, done: true });
            return;
        }
        await sleep(status.retry ? RETRY_MS : elapsed < 60 * 1000 ? 5000 : 10000, signal);
    }
}
