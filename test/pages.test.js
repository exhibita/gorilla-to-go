import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPages, getPageText, memoryStore } from '../app/js/pages.js';

const API = 'https://api.github.com';
const REPO = '/repos/exhibita/gtg-test-site';
const site = { id: 'site-1', owner: 'exhibita', repo: 'gtg-test-site', branch: 'main' };
const TOKEN = 'github_pat_TEST';

const json = (status, body) => new Response(JSON.stringify(body), { status });
const blob = text => json(200, { encoding: 'base64', content: Buffer.from(text).toString('base64') });
const md = (title, date) => `---\ntitle: ${title}\n${date ? `date: ${date}\n` : ''}---\nBody of ${title}\n`;

// A fake GitHub with a tree of files { path: text }. Counts requests and the most requests at one time.
function fakeGitHub(files, treeSha = 'TREE1') {
    const state = { files, treeSha, calls: [], inFlight: 0, maxInFlight: 0, offline: false };
    const shaOf = path => `sha-${Buffer.from(path + state.files[path]).toString('hex').slice(-12)}`;
    state.fetch = async url => {
        if (state.offline) throw new TypeError('Failed to fetch');
        const path = url.replace(API, '');
        state.calls.push(path);
        state.inFlight++;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        state.inFlight--;
        if (path === `${REPO}/branches/main`) return json(200, { commit: { commit: { tree: { sha: state.treeSha } } } });
        if (path === `${REPO}/git/trees/${state.treeSha}?recursive=1`) {
            return json(200, { truncated: false, tree: Object.keys(state.files).map(p => ({ path: p, type: 'blob', sha: shaOf(p) })) });
        }
        const blobMatch = path.match(/\/git\/blobs\/(.+)$/);
        if (blobMatch) {
            const found = Object.keys(state.files).find(p => shaOf(p) === blobMatch[1]);
            return found ? blob(state.files[found]) : json(404, {});
        }
        return json(404, {});
    };
    state.blobCalls = () => state.calls.filter(c => c.includes('/git/blobs/')).length;
    return state;
}

test('the first load reads the tree and every page, sorted newest first, with progress', async () => {
    const github = fakeGitHub({
        'src/blog/old/index.md': md('Old', '2025-01-01'),
        'src/blog/new/index.md': md('New', '2026-10-17'),
        'src/privacy/index.md': md('Privacy Policy'),
        'src/index.html': '<html>'
    });
    const progress = [];
    const result = await loadPages({ site, token: TOKEN, fetch: github.fetch, store: memoryStore(), onProgress: p => progress.push(p) });
    assert.deepEqual(result.pages.map(p => p.title), ['New', 'Old', 'Privacy Policy']);
    assert.equal(result.offline, false);
    assert.equal(github.blobCalls(), 3);
    assert.deepEqual(progress.at(0), { done: 0, total: 3 });
    assert.deepEqual(progress.at(-1), { done: 3, total: 3 });
});

test('when the tree is unchanged, the next load makes no file requests', async () => {
    const github = fakeGitHub({ 'src/blog/a/index.md': md('A', '2026-01-01') });
    const store = memoryStore();
    await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    github.calls.length = 0;
    const second = await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    assert.deepEqual(second.pages.map(p => p.title), ['A']);
    assert.equal(github.blobCalls(), 0);
    assert.equal(github.calls.length, 1); // Only the branch request: its tree SHA is unchanged.
});

test('when one page changes, only that page is read again', async () => {
    const github = fakeGitHub({ 'src/blog/a/index.md': md('A', '2026-01-01'), 'src/blog/b/index.md': md('B', '2026-01-02') });
    const store = memoryStore();
    await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    github.files['src/blog/b/index.md'] = md('B changed', '2026-01-02');
    github.treeSha = 'TREE2';
    github.calls.length = 0;
    const result = await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    assert.deepEqual(result.pages.map(p => p.title), ['B changed', 'A']);
    assert.equal(github.blobCalls(), 1);
});

test('a large site is read with no more than 6 requests at a time', async () => {
    const files = {};
    for (let i = 0; i < 25; i++) files[`src/blog/post-${i}/index.md`] = md(`Post ${i}`, '2026-01-01');
    const github = fakeGitHub(files);
    const result = await loadPages({ site, token: TOKEN, fetch: github.fetch, store: memoryStore() });
    assert.equal(result.pages.length, 25);
    assert.ok(github.maxInFlight <= 6, `max ${github.maxInFlight} requests at a time`);
    assert.ok(github.maxInFlight > 1, 'requests do not run in parallel');
});

test('offline with a saved list: the saved list is used and marked offline', async () => {
    const github = fakeGitHub({ 'src/blog/a/index.md': md('A', '2026-01-01') });
    const store = memoryStore();
    const first = await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    github.offline = true;
    const result = await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    assert.equal(result.offline, true);
    assert.deepEqual(result.pages.map(p => p.title), ['A']);
    assert.equal(result.fetchedAt, first.fetchedAt);
});

test('offline with no saved list: the load fails with "No connection to GitHub"', async () => {
    const github = fakeGitHub({});
    github.offline = true;
    await assert.rejects(loadPages({ site, token: TOKEN, fetch: github.fetch, store: memoryStore() }), { message: 'No connection to GitHub', offline: true });
});

test('files that no saved list uses are removed from the store', async () => {
    const github = fakeGitHub({ 'src/blog/a/index.md': md('A', '2026-01-01'), 'src/blog/b/index.md': md('B', '2026-01-02') });
    const store = memoryStore();
    await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    assert.equal(store.blobCount(), 2);
    delete github.files['src/blog/b/index.md'];
    github.treeSha = 'TREE2';
    await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    assert.equal(store.blobCount(), 1);
});

test('getPageText uses the saved text, and reads GitHub only when it is missing', async () => {
    const github = fakeGitHub({ 'src/blog/a/index.md': md('A', '2026-01-01') });
    const store = memoryStore();
    const { pages } = await loadPages({ site, token: TOKEN, fetch: github.fetch, store });
    github.calls.length = 0;
    assert.equal(await getPageText({ site, token: TOKEN, sha: pages[0].sha, fetch: github.fetch, store }), md('A', '2026-01-01'));
    assert.equal(github.calls.length, 0);
    const fresh = memoryStore();
    assert.equal(await getPageText({ site, token: TOKEN, sha: pages[0].sha, fetch: github.fetch, store: fresh }), md('A', '2026-01-01'));
    assert.equal(github.blobCalls(), 1);
});

test('after one file request fails, no new file requests start', async () => {
    const files = {};
    for (let i = 0; i < 30; i++) files[`src/blog/post-${i}/index.md`] = md(`Post ${i}`, '2026-01-01');
    const github = fakeGitHub(files);
    const realFetch = github.fetch;
    let blobRequests = 0;
    const failingFetch = async url => {
        if (url.includes('/git/blobs/') && ++blobRequests === 3) return new Response('{}', { status: 404 });
        return realFetch(url);
    };
    await assert.rejects(loadPages({ site, token: TOKEN, fetch: failingFetch, store: memoryStore() }));
    await new Promise(resolve => setTimeout(resolve, 100)); // Let running requests end.
    assert.ok(blobRequests <= 8, `${blobRequests} file requests after the failure point`);
});

test('no progress is reported after the load is stopped', async () => {
    const files = {};
    for (let i = 0; i < 12; i++) files[`src/blog/post-${i}/index.md`] = md(`Post ${i}`, '2026-01-01');
    const github = fakeGitHub(files);
    const controller = new AbortController();
    const progress = [];
    const load = loadPages({
        site, token: TOKEN, fetch: github.fetch, store: memoryStore(), signal: controller.signal,
        onProgress: p => {
            progress.push(p);
            if (p.done === 2) controller.abort();
        }
    });
    await load.catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(progress.every(p => p.done <= 2), `progress after the stop: ${JSON.stringify(progress.at(-1))}`);
});
