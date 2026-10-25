import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    INBOX_BRANCH, INBOX_FOLDER, memoryInboxStore, countWaiting, listWaiting, markPending, discard,
    recordPublished, runCleanup, deleteBranchIfEmpty, inboxOrigins, cleanAfterPublish
} from '../app/js/inbox.js';

const API = 'https://api.github.com';
const REPO = '/repos/exhibita/gtg-test-site';
const site = { id: 'site-1', owner: 'exhibita', repo: 'gtg-test-site', branch: 'main' };
const TOKEN = 'github_pat_TEST';

const json = (status, body) => new Response(JSON.stringify(body), { status });
const photo = (name, sha) => ({ name, path: `${INBOX_FOLDER}/${name}`, sha, type: 'file' });

// A fake GitHub with an inbox branch. state.files: the files in the folder. state.branch: false = no branch.
// state.deleteStatus: { path: status } for a file delete that fails. state.afterList(count): runs after a folder read.
function fakeGitHub(files = [], { branch = true } = {}) {
    const state = { files, branch, deleteStatus: {}, offline: false, calls: [], listReads: 0, afterList: () => {}, inFlight: 0, maxInFlight: 0 };
    state.fetch = async (url, init = {}) => {
        if (state.offline) throw new TypeError('Failed to fetch');
        const method = init.method ?? 'GET';
        const path = url.replace(API, '');
        const body = init.body ? JSON.parse(init.body) : undefined;
        state.calls.push({ method, path, body });
        if (method === 'GET' && path === `${REPO}/contents/${INBOX_FOLDER}?ref=${INBOX_BRANCH}`) {
            if (!state.branch) return json(404, {});
            state.listReads++;
            const reply = json(200, state.files);
            state.afterList(state.listReads);
            return reply;
        }
        if (method === 'GET' && path === `${REPO}/git/ref/heads/${INBOX_BRANCH}`) {
            return state.branch ? json(200, { object: { sha: 'REF1' } }) : json(404, {});
        }
        if (method === 'DELETE' && path === `${REPO}/git/refs/heads/${INBOX_BRANCH}`) {
            state.branch = false;
            return new Response(null, { status: 204 });
        }
        const fileDelete = path.match(/\/contents\/(gtg-inbox\/[^?]+)$/);
        if (method === 'DELETE' && fileDelete) {
            const filePath = fileDelete[1];
            const status = state.deleteStatus[filePath];
            if (status) return json(status, {});
            const index = state.files.findIndex(file => file.path === filePath);
            if (index < 0) return json(404, {});
            state.files.splice(index, 1);
            return json(200, { commit: { sha: 'C1' } });
        }
        if (method === 'GET' && path.match(/\/contents\/gtg-inbox\/[^?]+\?ref=/)) {
            const found = state.files.find(file => path.includes(file.path));
            return found ? json(200, { sha: found.sha }) : json(404, {});
        }
        if (method === 'GET' && path === `${REPO}/branches/${INBOX_BRANCH}`) {
            return state.branch ? json(200, {}) : json(404, {});
        }
        const blobMatch = path.match(/\/git\/blobs\/(.+)$/);
        if (blobMatch) {
            state.inFlight++;
            state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
            await new Promise(resolve => setTimeout(resolve, 5));
            state.inFlight--;
            return new Response(new Uint8Array([...Buffer.from(`bytes-of-${blobMatch[1]}`)]), { status: 200 });
        }
        return json(500, {});
    };
    state.deletes = () => state.calls.filter(call => call.method === 'DELETE');
    return state;
}

function setup(files, options) {
    const github = fakeGitHub(files, options);
    const store = memoryInboxStore();
    return { github, store, opts: { site, token: TOKEN, fetch: github.fetch, store } };
}

test('countWaiting counts the files in the inbox folder', async () => {
    const { opts } = setup([photo('a.jpg', 's1'), photo('b.jpg', 's2')]);
    assert.equal(await countWaiting(opts), 2);
});

test('countWaiting returns null when there is no connection', async () => {
    const { github, opts } = setup([photo('a.jpg', 's1')]);
    github.offline = true;
    assert.equal(await countWaiting(opts), null);
});

test('listWaiting returns an empty list when the inbox branch does not exist', async () => {
    const { opts } = setup([], { branch: false });
    assert.deepEqual(await listWaiting(opts), []);
});

test('listWaiting returns the bytes of each photo, with no more than 4 downloads at once', async () => {
    const files = Array.from({ length: 7 }, (_, i) => photo(`p${i}.jpg`, `s${i}`));
    const { github, opts } = setup(files);
    const waiting = await listWaiting(opts);
    assert.deepEqual(waiting.map(item => item.name), files.map(file => file.name));
    assert.equal(waiting[0].path, 'gtg-inbox/p0.jpg');
    assert.equal(waiting[0].sha, 's0');
    assert.equal(Buffer.from(waiting[3].bytes).toString(), 'bytes-of-s3');
    assert.ok(github.maxInFlight <= 4 && github.maxInFlight > 1);
});

test('listWaiting does not list a published photo that is still on the cleanup list', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1'), photo('b.jpg', 's2')]);
    github.deleteStatus['gtg-inbox/a.jpg'] = 500;
    await recordPublished({ ...opts, origins: [{ path: 'gtg-inbox/a.jpg', sha: 's1' }] });
    assert.deepEqual((await listWaiting(opts)).map(item => item.name), ['b.jpg']);
    assert.equal((await store.get(site.id)).cleanup.length, 1);
});

test('markPending marks a photo that a local edit already has', () => {
    const waiting = [{ sha: 's1', name: 'a.jpg' }, { sha: 's2', name: 'b.jpg' }];
    const edits = [
        { images: [{ path: 'src/x.jpg', inbox: { path: 'gtg-inbox/a.jpg', sha: 's1' } }, { path: 'src/y.jpg' }] },
        { text: 'no images field' }
    ];
    assert.deepEqual(markPending(waiting, edits), [{ sha: 's1', name: 'a.jpg', pending: true }, { sha: 's2', name: 'b.jpg' }]);
    assert.equal(waiting[0].pending, undefined);
});

test('runCleanup deletes the published files and keeps a file whose delete failed on the list', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1'), photo('b.jpg', 's2'), photo('c.jpg', 's3')]);
    github.deleteStatus['gtg-inbox/b.jpg'] = 500;
    await recordPublished({ ...opts, origins: [
        { path: 'gtg-inbox/a.jpg', sha: 's1' }, { path: 'gtg-inbox/b.jpg', sha: 's2' }, { path: 'gtg-inbox/c.jpg', sha: 's3' }
    ] });
    await runCleanup(opts);
    assert.deepEqual((await store.get(site.id)).cleanup, [{ path: 'gtg-inbox/b.jpg', sha: 's2' }]);
    assert.deepEqual(github.files.map(file => file.name), ['b.jpg']);
    assert.equal(github.branch, true);
});

test('runCleanup counts a file that is already gone as deleted', async () => {
    const { github, store, opts } = setup([]);
    await recordPublished({ ...opts, origins: [{ path: 'gtg-inbox/a.jpg', sha: 's1' }] });
    await runCleanup(opts);
    assert.deepEqual((await store.get(site.id)).cleanup, []);
    assert.equal(github.branch, false);
});

test('runCleanup counts a file as deleted when the inbox branch is gone', async () => {
    const { store, opts } = setup([], { branch: false });
    await recordPublished({ ...opts, origins: [{ path: 'gtg-inbox/a.jpg', sha: 's1' }] });
    await runCleanup(opts);
    assert.deepEqual((await store.get(site.id)).cleanup, []);
});

test('runCleanup keeps the list when there is no connection', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1')]);
    await recordPublished({ ...opts, origins: [{ path: 'gtg-inbox/a.jpg', sha: 's1' }] });
    github.offline = true;
    await runCleanup(opts);
    assert.equal((await store.get(site.id)).cleanup.length, 1);
});

test('runCleanup with an empty list sends no request', async () => {
    const { github, opts } = setup([photo('a.jpg', 's1')]);
    await runCleanup(opts);
    assert.equal(github.calls.length, 0);
});

test('the branch is deleted when the folder is empty on both reads', async () => {
    const { github, opts } = setup([]);
    assert.deepEqual(await deleteBranchIfEmpty(opts), { deleted: true });
    assert.equal(github.listReads, 2);
    assert.equal(github.deletes().length, 1);
});

test('the branch is deleted only when the folder is empty on both reads', async () => {
    const { github, opts } = setup([]);
    github.afterList = count => {
        if (count === 1) github.files.push(photo('new.jpg', 'sNEW'));
    };
    assert.deepEqual(await deleteBranchIfEmpty(opts), { deleted: false });
    assert.equal(github.deletes().length, 0);
    assert.equal(github.branch, true);
});

test('the branch stays when the folder has a photo', async () => {
    const { github, opts } = setup([photo('a.jpg', 's1')]);
    assert.deepEqual(await deleteBranchIfEmpty(opts), { deleted: false });
    assert.equal(github.deletes().length, 0);
});

test('no DELETE when the inbox branch does not exist', async () => {
    const { github, opts } = setup([], { branch: false });
    assert.deepEqual(await deleteBranchIfEmpty(opts), { deleted: false });
    assert.equal(github.deletes().length, 0);
});

test('discard deletes the file on the inbox branch with its SHA, then the empty branch', async () => {
    const { github, opts } = setup([photo('a.jpg', 's1')]);
    await discard({ ...opts, item: { name: 'a.jpg', path: 'gtg-inbox/a.jpg', sha: 's1' } });
    const [fileDelete, branchDelete] = github.deletes();
    assert.equal(fileDelete.path, `${REPO}/contents/gtg-inbox/a.jpg`);
    assert.deepEqual(fileDelete.body, { message: 'Remove a photo from the gallery inbox', sha: 's1', branch: 'gtg-inbox' });
    assert.equal(branchDelete.path, `${REPO}/git/refs/heads/gtg-inbox`);
});

test('discard keeps the branch when other photos wait', async () => {
    const { github, opts } = setup([photo('a.jpg', 's1'), photo('b.jpg', 's2')]);
    await discard({ ...opts, item: { name: 'a.jpg', path: 'gtg-inbox/a.jpg', sha: 's1' } });
    assert.equal(github.deletes().length, 1);
    assert.equal(github.branch, true);
});

test('recordPublished does not list the same file twice', async () => {
    const { store, opts } = setup([]);
    const origin = { path: 'gtg-inbox/a.jpg', sha: 's1' };
    await recordPublished({ ...opts, origins: [origin] });
    await recordPublished({ ...opts, origins: [origin] });
    assert.equal((await store.get(site.id)).cleanup.length, 1);
});

test('inboxOrigins returns the inbox field of each image that has one', () => {
    const images = [{ path: 'src/a.jpg', inbox: { path: 'gtg-inbox/a.jpg', sha: 's1', extra: 1 } }, { path: 'src/b.jpg' }];
    assert.deepEqual(inboxOrigins(images), [{ path: 'gtg-inbox/a.jpg', sha: 's1' }]);
});

test('cleanAfterPublish deletes only the images that came from the inbox', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1'), photo('other.jpg', 's9')]);
    await cleanAfterPublish({ ...opts, images: [
        { path: 'src/a.jpg', inbox: { path: 'gtg-inbox/a.jpg', sha: 's1' } },
        { path: 'src/b.jpg' }
    ] });
    const deletes = github.deletes();
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].path, `${REPO}/contents/gtg-inbox/a.jpg`);
    assert.equal(deletes[0].body.branch, 'gtg-inbox');
    assert.deepEqual((await store.get(site.id)).cleanup, []);
    assert.equal(github.branch, true);
});

test('cleanAfterPublish does nothing for images without an inbox origin', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1')]);
    await cleanAfterPublish({ ...opts, images: [{ path: 'src/b.jpg' }] });
    assert.equal(github.calls.length, 0);
    assert.equal(await store.get(site.id), undefined);
});

test('cleanAfterPublish keeps the file on the list when the delete fails, and does not throw', async () => {
    const { github, store, opts } = setup([photo('a.jpg', 's1')]);
    github.offline = true;
    await cleanAfterPublish({ ...opts, images: [{ path: 'src/a.jpg', inbox: { path: 'gtg-inbox/a.jpg', sha: 's1' } }] });
    assert.deepEqual((await store.get(site.id)).cleanup, [{ path: 'gtg-inbox/a.jpg', sha: 's1' }]);
});
