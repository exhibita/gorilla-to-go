import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setDraft } from '../app/js/frontmatter-write.js';
import { parseFrontmatter, isDraft } from '../app/js/frontmatter.js';
import { filterPages } from '../app/js/pages-logic.js';
import { listBuildRuns, saveFile, deleteFile } from '../app/js/github.js';
import { buildState, buildStatusText, buildStatusHtml, watchBuild, rememberCommit, recentCommit } from '../app/js/build-status.js';

const TOKEN = 'github_pat_TESTTOKEN123';
const API = 'https://api.github.com';
const REPO = '/repos/exhibita/gtg-test-site';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const draftOf = raw => isDraft(parseFrontmatter(`---\n${raw}\n---\n`).data);

// ---------- setDraft ----------

test('setDraft adds draft: true and removes the key again', () => {
    const raw = 'title: "A"\ndate: 2026-10-18\nskeleton: blog';
    const on = setDraft(raw, true);
    assert.equal(on, 'title: "A"\ndate: 2026-10-18\nskeleton: blog\ndraft: true');
    assert.equal(draftOf(on), true);
    assert.equal(setDraft(on, false), raw);
});

test('setDraft keeps the text when the state does not change', () => {
    for (const raw of ['title: A\ndraft: "TRUE"', 'title: A\ndraft: True # later', 'title: A', 'title: A\ndraft: false']) {
        assert.equal(setDraft(raw, draftOf(raw)), raw, raw);
    }
});

test('setDraft changes only the draft line', () => {
    assert.equal(setDraft('title: A\ndraft: false\nskeleton: blog', true), 'title: A\ndraft: true\nskeleton: blog');
    assert.equal(setDraft('title: A\ndraft: yes please\nskeleton: blog', true), 'title: A\ndraft: true\nskeleton: blog', 'not a draft by decision 22');
    assert.equal(setDraft('title: A\ndraft: "true"\nskeleton: blog', false), 'title: A\nskeleton: blog');
    assert.equal(setDraft('', true), 'draft: true');
});

// ---------- Drafts filter ----------

test('filterPages has a Drafts filter', () => {
    const pages = [
        { type: 'blog', title: 'One', slug: 'one', draft: true },
        { type: 'page', title: 'Two', slug: 'two', draft: false },
        { type: 'gallery', title: 'Three', slug: 'three', draft: true }
    ];
    assert.deepEqual(filterPages(pages, { type: 'draft' }).map(p => p.slug), ['one', 'three']);
    assert.deepEqual(filterPages(pages, { type: 'draft', query: 'thr' }).map(p => p.slug), ['three']);
});

// ---------- listBuildRuns ----------

const RUN = (over = {}) => ({
    id: 1, name: 'Deploy to GitHub Pages', head_sha: 'C1', status: 'completed', conclusion: 'success',
    html_url: 'https://github.com/exhibita/gtg-test-site/actions/runs/1', created_at: '2026-10-18T10:00:00Z', updated_at: '2026-10-18T10:01:00Z', ...over
});

test('listBuildRuns asks for the runs of the branch (and the commit) and gives the fields the app uses', async () => {
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url, init });
        return json(200, { total_count: 1, workflow_runs: [RUN()] });
    };
    const runs = await listBuildRuns({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', headSha: 'C1', token: TOKEN, fetch });
    assert.equal(calls[0].url, `${API}${REPO}/actions/runs?branch=main&per_page=20&head_sha=C1`);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
    assert.deepEqual(runs, [{ sha: 'C1', status: 'completed', conclusion: 'success', url: RUN().html_url, createdAt: RUN().created_at, updatedAt: RUN().updated_at }]);
    await listBuildRuns({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch });
    assert.equal(calls[1].url, `${API}${REPO}/actions/runs?branch=main&per_page=20`);
});

test('listBuildRuns: no Actions access and no connection are recognizable', async () => {
    const base = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN };
    await assert.rejects(listBuildRuns({ ...base, fetch: async () => json(403, {}) }), err => err.noAccess === true);
    await assert.rejects(listBuildRuns({ ...base, fetch: async () => json(404, {}) }), err => err.noAccess === true);
    await assert.rejects(listBuildRuns({ ...base, fetch: async () => { throw new TypeError('Failed to fetch'); } }), err => err.offline === true);
});

// ---------- buildState ----------

const run = (sha, status, conclusion = null, createdAt = '2026-10-18T10:00:00Z') => ({ sha, status, conclusion, url: `u-${sha}-${conclusion}`, createdAt, updatedAt: createdAt });

test('buildState for one commit: waiting, publishing, live, failed, stopped, none', () => {
    assert.equal(buildState([], { sha: 'C1', elapsedMs: 10000 }).state, 'waiting');
    assert.equal(buildState([], { sha: 'C1', elapsedMs: 200000 }).state, 'none');
    assert.equal(buildState([run('C1', 'queued')], { sha: 'C1' }).state, 'publishing');
    assert.equal(buildState([run('C1', 'in_progress')], { sha: 'C1' }).state, 'publishing');
    assert.equal(buildState([run('C1', 'completed', 'success')], { sha: 'C1' }).state, 'live');
    const failed = buildState([run('C1', 'completed', 'success'), run('C1', 'completed', 'failure')], { sha: 'C1' });
    assert.equal(failed.state, 'failed');
    assert.equal(failed.url, 'u-C1-failure');
    assert.equal(buildState([run('C1', 'completed', 'cancelled')], { sha: 'C1' }).state, 'stopped');
    assert.equal(buildState([run('C1', 'completed', 'skipped'), run('C1', 'completed', 'success')], { sha: 'C1' }).state, 'live');
    assert.equal(buildState([run('C1', 'completed', 'failure'), run('C1', 'in_progress')], { sha: 'C1' }).state, 'publishing', 'running first');
    assert.equal(buildState([run('C0', 'completed', 'success')], { sha: 'C1', elapsedMs: 1000 }).state, 'waiting', 'another commit does not count');
});

test('buildState without a commit uses the newest commit on the branch', () => {
    const runs = [
        run('OLD', 'completed', 'failure', '2026-10-18T09:00:00Z'),
        run('NEW', 'completed', 'success', '2026-10-18T10:00:00Z')
    ];
    assert.equal(buildState(runs).state, 'live');
    assert.equal(buildState([]).state, 'none');
});

test('buildState says when the build is done', () => {
    assert.equal(buildState([run('C1', 'in_progress')], { sha: 'C1' }).done, false);
    assert.equal(buildState([], { sha: 'C1', elapsedMs: 0 }).done, false);
    for (const conclusion of ['success', 'failure', 'cancelled']) assert.equal(buildState([run('C1', 'completed', conclusion)], { sha: 'C1' }).done, true);
});

test('buildStatusText has a short label and a sentence for each state', () => {
    for (const state of ['waiting', 'publishing', 'live', 'failed', 'stopped', 'none', 'noAccess', 'offline']) {
        const text = buildStatusText({ state });
        assert.ok(text.label && text.sentence, state);
    }
    assert.equal(buildStatusText({ state: 'live' }).label, 'Live');
    assert.equal(buildStatusText({ state: 'publishing' }).label, 'Publishing');
    assert.equal(buildStatusText({ state: 'failed' }).label, 'Build failed');
});

test('buildStatusHtml escapes the text and links only to github.com', () => {
    const failed = buildStatusHtml({ state: 'failed', url: 'https://github.com/o/r/actions/runs/1' });
    assert.match(failed, /Build failed/);
    assert.match(failed, /href="https:\/\/github\.com\/o\/r\/actions\/runs\/1"/);
    assert.doesNotMatch(buildStatusHtml({ state: 'failed', url: 'javascript:alert(1)' }), /href/);
    assert.doesNotMatch(buildStatusHtml({ state: 'live', url: 'https://github.com/x' }), /href/, 'no link when live');
    assert.match(buildStatusHtml({ state: 'live' }, { time: '3:04 PM' }), /Last build: 3:04 PM/);
    assert.match(buildStatusHtml({ state: 'publishing' }), /spinner/);
});

test('rememberCommit keeps the last commit of a site for 20 minutes', () => {
    rememberCommit('s1', 'C9', 1000);
    assert.equal(recentCommit('s1', 1000 + 60 * 1000), 'C9');
    assert.equal(recentCommit('s1', 1000 + 21 * 60 * 1000), null);
    assert.equal(recentCommit('other', 1000), null);
    rememberCommit('s1', null, 5000);
    assert.equal(recentCommit('s1', 5000), 'C9', 'no SHA: no change');
});

// ---------- watchBuild ----------

test('watchBuild asks again until the build ends, then stops', async () => {
    const answers = [[], [run('C1', 'queued')], [run('C1', 'in_progress')], [run('C1', 'completed', 'success')]];
    let calls = 0;
    const states = [];
    await watchBuild({
        list: async () => answers[Math.min(calls++, answers.length - 1)],
        sha: 'C1',
        onChange: status => states.push(status.state),
        sleep: async () => {}
    });
    assert.deepEqual(states, ['waiting', 'publishing', 'live']);
    assert.equal(calls, 4);
});

test('watchBuild stops when the signal stops it, and after the time limit', async () => {
    const controller = new AbortController();
    let calls = 0;
    await watchBuild({
        list: async () => {
            calls++;
            if (calls === 2) controller.abort();
            return [run('C1', 'in_progress')];
        },
        sha: 'C1',
        onChange: () => {},
        signal: controller.signal,
        sleep: async () => {}
    });
    assert.equal(calls, 2);

    let clock = 0;
    const states = [];
    await watchBuild({
        list: async () => [run('C1', 'in_progress')],
        sha: 'C1',
        onChange: status => states.push(status.state),
        sleep: async ms => { clock += ms; },
        now: () => clock
    });
    assert.equal(states.at(-1), 'tooLong');
    assert.ok(clock >= 20 * 60 * 1000);
});

test('watchBuild stops at once without Actions access, and when offline', async () => {
    for (const [err, state] of [[Object.assign(new Error('x'), { noAccess: true }), 'noAccess'], [Object.assign(new Error('x'), { offline: true }), 'offline']]) {
        let calls = 0;
        const states = [];
        await watchBuild({ list: async () => { calls++; throw err; }, sha: 'C1', onChange: s => states.push(s.state), sleep: async () => {} });
        assert.equal(calls, 1);
        assert.deepEqual(states, [state]);
    }
});

// ---------- Commit SHAs ----------

test('saveFile and deleteFile give the commit SHA', async () => {
    const base = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/x/index.md', token: TOKEN, message: 'm' };
    const saved = await saveFile({ ...base, text: 'T', sha: 'OLD', fetch: async () => json(200, { content: { sha: 'NEW' }, commit: { sha: 'COMMIT1' } }) });
    assert.deepEqual(saved, { sha: 'NEW', commitSha: 'COMMIT1' });
    const deleted = await deleteFile({ ...base, sha: 'OLD', fetch: async () => json(200, { commit: { sha: 'COMMIT2' } }) });
    assert.deepEqual(deleted, { commitSha: 'COMMIT2' });
});
