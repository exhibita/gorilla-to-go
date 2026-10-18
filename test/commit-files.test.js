import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { commitFiles, gitBlobSha, getImageDataUrl, listFolder } from '../app/js/github.js';

const TOKEN = 'github_pat_TESTTOKEN123';
const API = 'https://api.github.com';
const REPO = '/repos/exhibita/gtg-test-site';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The SHA that git gives a file: SHA-1 of "blob <size>\0<bytes>".
const gitSha = bytes => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), Buffer.from(bytes)])).digest('hex');

const PAGE = 'src/blog/p/index.md';
const OLD_TEXT = '---\ntitle: "P"\n---\nOld';
const NEW_TEXT = '---\ntitle: "P"\n---\nNew ![A cat](./images/blog/p/cat.jpg)';
const CAT = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 250]);
const DOG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);
const CAT_PATH = 'src/images/blog/p/cat.jpg';
const DOG_PATH = 'src/images/blog/p/dog.png';

// A small fake of the GitHub Git Data API: commits with their files (path → blob SHA), and one branch.
function fakeGitHub({ files = { [PAGE]: gitSha(Buffer.from(OLD_TEXT)), 'src/index.md': 'INDEXSHA' } } = {}) {
    const state = {
        ref: 'C1',
        commits: { C1: { tree: 'T1', files, parents: [] } },
        trees: { T1: files },
        calls: [],
        beforePatch: null, // Runs before GitHub handles the ref update, for example to move the branch.
        patchTimesOut: false,
        offline: false
    };
    let next = 1;

    // Make another commit on the branch, as a second device or github.com would.
    state.push = changes => {
        const id = `X${next++}`;
        const files = { ...state.commits[state.ref].files, ...changes };
        state.trees[`T${id}`] = files;
        state.commits[id] = { tree: `T${id}`, files, parents: [state.ref] };
        state.ref = id;
    };

    const fetch = async (url, init = {}) => {
        if (state.offline) throw new TypeError('Failed to fetch');
        const method = init.method || 'GET';
        const path = url.replace(API + REPO, '');
        const body = init.body ? JSON.parse(init.body) : undefined;
        state.calls.push({ method, path, body, headers: init.headers });

        if (method === 'GET' && path === '/git/ref/heads/main') return json(200, { object: { sha: state.ref } });
        let m = path.match(/^\/git\/commits\/(\w+)$/);
        if (method === 'GET' && m) return json(200, { sha: m[1], tree: { sha: state.commits[m[1]].tree } });
        m = path.match(/^\/contents\/(.+)\?ref=(\w+)$/);
        if (method === 'GET' && m) {
            const at = state.commits[m[2]].files;
            const target = decodeURIComponent(m[1]);
            if (at[target]) return json(200, { type: 'file', path: target, sha: at[target] });
            const children = Object.keys(at).filter(p => p.startsWith(`${target}/`) && !p.slice(target.length + 1).includes('/'));
            if (children.length) return json(200, children.map(p => ({ type: 'file', path: p, name: p.split('/').pop(), sha: at[p] })));
            return json(404, { message: 'Not Found' });
        }
        if (method === 'POST' && path === '/git/blobs') {
            assert.equal(body.encoding, 'base64');
            return json(201, { sha: gitSha(Buffer.from(body.content, 'base64')) });
        }
        if (method === 'POST' && path === '/git/trees') {
            const id = `T${next++}`;
            const files = { ...state.trees[body.base_tree] };
            for (const entry of body.tree) files[entry.path] = entry.sha ?? gitSha(Buffer.from(entry.content));
            state.trees[id] = files;
            return json(201, { sha: id });
        }
        if (method === 'POST' && path === '/git/commits') {
            const id = `C${next++}`;
            state.commits[id] = { tree: body.tree, files: state.trees[body.tree], parents: body.parents, message: body.message };
            return json(201, { sha: id });
        }
        if (method === 'PATCH' && path === '/git/refs/heads/main') {
            state.beforePatch?.();
            assert.equal(body.force, false, 'never force: a moved branch must not lose commits');
            if (state.commits[body.sha].parents[0] !== state.ref) return json(422, { message: 'Update is not a fast forward' });
            state.ref = body.sha;
            if (state.patchTimesOut) throw new TypeError('Failed to fetch');
            return json(200, { object: { sha: body.sha } });
        }
        throw new Error(`unexpected request ${method} ${path}`);
    };
    return { state, fetch };
}

const args = (fetch, overrides = {}) => ({
    owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch,
    page: { path: PAGE, text: NEW_TEXT, baseSha: gitSha(Buffer.from(OLD_TEXT)) },
    images: [{ path: CAT_PATH, base64: CAT.toString('base64') }],
    message: 'Edit p with Gorilla To Go',
    ...overrides
});

const posts = state => state.calls.filter(c => c.method !== 'GET');
const head = state => state.commits[state.ref];

test('gitBlobSha gives the same SHA as git', async () => {
    assert.equal(await gitBlobSha(new TextEncoder().encode('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
    assert.equal(await gitBlobSha(CAT), gitSha(CAT));
});

test('commitFiles puts the page and its images in one commit on the branch', async () => {
    const { state, fetch } = fakeGitHub();
    const progress = [];
    const result = await commitFiles(args(fetch, {
        images: [{ path: CAT_PATH, base64: CAT.toString('base64') }, { path: DOG_PATH, base64: DOG.toString('base64') }],
        onProgress: p => progress.push(p)
    }));

    assert.deepEqual(result, { sha: gitSha(Buffer.from(NEW_TEXT)) });
    assert.deepEqual(head(state).parents, ['C1'], 'one new commit on top of the branch');
    assert.equal(head(state).message, 'Edit p with Gorilla To Go');
    assert.equal(head(state).files[PAGE], gitSha(Buffer.from(NEW_TEXT)));
    assert.equal(head(state).files[CAT_PATH], gitSha(CAT));
    assert.equal(head(state).files[DOG_PATH], gitSha(DOG));
    assert.equal(head(state).files['src/index.md'], 'INDEXSHA', 'other files stay');
    assert.deepEqual(progress, [{ done: 0, total: 2 }, { done: 1, total: 2 }, { done: 2, total: 2 }]);
    assert.deepEqual(posts(state).map(c => `${c.method} ${c.path}`), [
        'POST /git/blobs', 'POST /git/blobs', 'POST /git/trees', 'POST /git/commits', 'PATCH /git/refs/heads/main'
    ]);
    const tree = posts(state).find(c => c.path === '/git/trees').body;
    assert.equal(tree.base_tree, 'T1');
    assert.ok(tree.tree.every(entry => entry.mode === '100644' && entry.type === 'blob'));
    assert.ok(state.calls.every(c => c.headers.Authorization === `Bearer ${TOKEN}`));
});

test('commitFiles creates a new page when no file has its path', async () => {
    const { state, fetch } = fakeGitHub();
    const path = 'src/blog/new/index.md';
    await commitFiles(args(fetch, { page: { path, text: 'Hi', baseSha: null }, images: [{ path: 'src/images/blog/new/a.jpg', base64: CAT.toString('base64') }] }));
    assert.equal(head(state).files[path], gitSha(Buffer.from('Hi')));
});

test('commitFiles stops when the page changed on GitHub, and sends nothing', async () => {
    const { state, fetch } = fakeGitHub();
    state.push({ [PAGE]: 'SOMEONEELSE' });
    await assert.rejects(commitFiles(args(fetch)), err => err.conflict === true && err.message === 'This page changed on GitHub after you opened it.');
    assert.deepEqual(posts(state), []);
});

test('commitFiles stops when a new page exists on GitHub now', async () => {
    const { state, fetch } = fakeGitHub();
    await assert.rejects(commitFiles(args(fetch, { page: { path: PAGE, text: 'Hi', baseSha: null } })), err => err.conflict === true);
    assert.deepEqual(posts(state), []);
});

test('commitFiles: when the branch moves during the commit, it checks again and commits on the new top', async () => {
    const { state, fetch } = fakeGitHub();
    state.beforePatch = () => {
        state.beforePatch = null;
        state.push({ 'src/about/index.md': 'OTHERDEVICE' });
    };
    await commitFiles(args(fetch));
    assert.equal(head(state).files['src/about/index.md'], 'OTHERDEVICE', 'the other commit is kept');
    assert.equal(head(state).files[PAGE], gitSha(Buffer.from(NEW_TEXT)));
    assert.equal(posts(state).filter(c => c.path === '/git/blobs').length, 1, 'the image is uploaded once');
});

test('commitFiles: when the branch moves and the page changed, nothing is overwritten', async () => {
    const { state, fetch } = fakeGitHub();
    state.beforePatch = () => {
        state.beforePatch = null;
        state.push({ [PAGE]: 'SOMEONEELSE' });
    };
    await assert.rejects(commitFiles(args(fetch)), err => err.conflict === true);
    assert.equal(head(state).files[PAGE], 'SOMEONEELSE');
});

test('commitFiles gives up when the branch keeps moving', async () => {
    const { state, fetch } = fakeGitHub();
    state.beforePatch = () => state.push({ 'src/x.md': String(Math.random()) });
    await assert.rejects(commitFiles(args(fetch)), err => !err.conflict && /Try again/.test(err.message));
    assert.equal(posts(state).filter(c => c.method === 'PATCH').length, 3);
});

test('commitFiles: a refusal while the branch did not move gives the reason from GitHub, with no retry', async () => {
    const { state, fetch } = fakeGitHub();
    const ruled = async (url, init = {}) => (init.method === 'PATCH'
        ? (state.calls.push({ method: 'PATCH', path: 'refs' }), json(422, { message: 'Repository rule violations found' }))
        : fetch(url, init));
    await assert.rejects(commitFiles(args(ruled)), { message: 'GitHub refused the publish: Repository rule violations found' });
    assert.equal(state.calls.filter(c => c.method === 'PATCH').length, 1);
    assert.equal(state.ref, 'C1');
});

test('commitFiles: an image name that differs only in letter case is a clash', async () => {
    const { state, fetch } = fakeGitHub();
    state.push({ 'src/images/blog/p/Cat.jpg': 'ANOTHERCAT' });
    await assert.rejects(commitFiles(args(fetch)), err => err.imageExists === CAT_PATH);
    assert.deepEqual(posts(state), []);
});

test('commitFiles never overwrites another image with the same name', async () => {
    const { state, fetch } = fakeGitHub();
    state.push({ [CAT_PATH]: 'ANOTHERCAT' });
    await assert.rejects(commitFiles(args(fetch)), err => err.imageExists === CAT_PATH && /cat\.jpg/.test(err.message));
    assert.deepEqual(posts(state), []);
});

test('commitFiles does not upload an image that GitHub has already', async () => {
    const { state, fetch } = fakeGitHub();
    state.push({ [CAT_PATH]: gitSha(CAT) });
    await commitFiles(args(fetch));
    assert.equal(posts(state).filter(c => c.path === '/git/blobs').length, 0);
    assert.equal(head(state).files[PAGE], gitSha(Buffer.from(NEW_TEXT)));
});

test('commitFiles: a ref update that timed out but reached GitHub is a success', async () => {
    const { state, fetch } = fakeGitHub();
    state.patchTimesOut = true;
    assert.deepEqual(await commitFiles(args(fetch)), { sha: gitSha(Buffer.from(NEW_TEXT)) });
    assert.equal(posts(state).filter(c => c.method === 'PATCH').length, 1, 'no second commit');
});

test('commitFiles: a page and images that are on GitHub already are a success, with no new commit', async () => {
    const { state, fetch } = fakeGitHub();
    state.push({ [PAGE]: gitSha(Buffer.from(NEW_TEXT)), [CAT_PATH]: gitSha(CAT) });
    await commitFiles(args(fetch));
    assert.deepEqual(posts(state), []);
});

test('commitFiles reports no connection', async () => {
    const { state, fetch } = fakeGitHub();
    state.offline = true;
    await assert.rejects(commitFiles(args(fetch)), err => err.offline === true && err.message === 'No connection to GitHub');
});

test('commitFiles reports a refused token and no write access', async () => {
    await assert.rejects(commitFiles(args(async () => json(401, {}))), { message: 'Token not accepted' });
    const { fetch } = fakeGitHub();
    const readOnly = async (url, init = {}) => (init.method === 'POST' ? json(403, {}) : fetch(url, init));
    await assert.rejects(commitFiles(args(readOnly)), { message: 'No write access' });
});

test('listFolder gives the files in a folder, and no files when there is no folder', async () => {
    const routes = {
        [`${API}${REPO}/contents/src/images/blog/p?ref=main`]: () => json(200, [
            { type: 'file', name: 'cat.jpg', path: CAT_PATH, sha: 'S1' },
            { type: 'dir', name: 'old', path: 'src/images/blog/p/old', sha: 'S2' }
        ]),
        [`${API}${REPO}/contents/src/images/blog/none?ref=main`]: () => json(404, {})
    };
    const routed = async url => routes[url]();
    const base = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: routed };
    assert.deepEqual(await listFolder({ ...base, path: 'src/images/blog/p' }), [{ name: 'cat.jpg', path: CAT_PATH, sha: 'S1' }]);
    assert.deepEqual(await listFolder({ ...base, path: 'src/images/blog/none' }), []);
    await assert.rejects(listFolder({ ...base, path: 'x', fetch: async () => { throw new TypeError('Failed to fetch'); } }), err => err.offline === true);
});

test('getImageDataUrl reads the file bytes from GitHub and makes a data: URL', async () => {
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response(CAT, { status: 200 });
    };
    const url = await getImageDataUrl({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/images/blog/my post/cat.jpg', token: TOKEN, fetch });
    assert.equal(url, `data:image/jpeg;base64,${CAT.toString('base64')}`);
    assert.equal(calls[0].url, `${API}${REPO}/contents/src/images/blog/my%20post/cat.jpg?ref=main`);
    assert.equal(calls[0].init.headers.Accept, 'application/vnd.github.raw+json');
});

test('getImageDataUrl gives null for a missing file, an unknown type or no connection', async () => {
    const base = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN };
    assert.equal(await getImageDataUrl({ ...base, path: 'src/images/a.jpg', fetch: async () => json(404, {}) }), null);
    assert.equal(await getImageDataUrl({ ...base, path: 'src/images/a.exe', fetch: async () => new Response(CAT) }), null);
    assert.equal(await getImageDataUrl({ ...base, path: 'src/images/a.png', fetch: async () => { throw new TypeError('Failed to fetch'); } }), null);
});
