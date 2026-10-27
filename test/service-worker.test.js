import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { APP, appFiles } from './helpers.js';
import { VERSION } from '../app/js/version.js';
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('the service worker precaches every app file, so the app opens offline', () => {
    // CNAME is for GitHub Pages only. The app does not load it.
    const files = appFiles().filter(f => f !== 'sw.js' && f !== 'CNAME');
    for (const file of files) {
        assert.ok(assets.includes(file), `${file} is not in ASSETS in sw.js`);
    }
});

test('every precached file exists', () => {
    for (const asset of assets.filter(a => a !== './')) {
        assert.ok(fs.existsSync(path.join(APP, asset)), `${asset} is in ASSETS but does not exist`);
    }
});

test('the cache name changes with the app version, so an update replaces the old files', () => {
    assert.match(sw, new RegExp(`const VERSION = '${VERSION.replace(/\./g, '\\.')}';`));
});

test('the service worker does not cache GitHub API responses', () => {
    assert.match(sw, /url\.origin !== self\.location\.origin/);
});

test('the service worker uses the cache only when the network fails, never after a time limit', () => {
    // A time limit mixed new files with cached files of an older version: the app did not start.
    assert.doesNotMatch(sw, /setTimeout/);
});

// Runs sw.js in a vm with a small fake worker scope. Real Response, Request, URL and FormData come from Node.
function loadWorker(cacheKeys = [], { failPutAt = 0 } = {}) {
    const listeners = {};
    const store = new Map();
    const deleted = [];
    const opened = [];
    let puts = 0;
    const scope = 'https://example.test/app/';
    const self = {
        location: new URL(scope + 'sw.js'),
        registration: { scope },
        clients: { claim: async () => {} },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: async () => {}
    };
    const caches = {
        open: async name => {
            opened.push(name);
            return { put: async (key, response) => {
                    if (++puts === failPutAt) throw new Error('quota');
                    store.set(key, response);
                }, delete: async key => store.delete(key) };
        },
        keys: async () => cacheKeys,
        delete: async key => { deleted.push(key); return true; }
    };
    vm.runInNewContext(sw, { self, caches, Response, Request, URL, fetch: async () => { throw new Error('no network'); } });
    return { listeners, store, deleted, opened };
}

async function share(files, url = 'https://example.test/app/share-target', formData) {
    const worker = loadWorker();
    const form = new FormData();
    for (const file of files) form.append('photos', file);
    let answer;
    worker.listeners.fetch({ request: { method: 'POST', url, formData: formData ?? (async () => form) }, respondWith: p => { answer = p; } });
    return { worker, response: await answer };
}

test('a share POST keeps each image and redirects to the share screen', async () => {
    const { worker, response } = await share([
        new File(['one'], 'a b.jpg', { type: 'image/jpeg' }),
        new File(['note'], 'note.txt', { type: 'text/plain' }),
        new File(['two'], 'c.png', { type: 'image/png' })
    ]);
    assert.equal(response.status, 303);
    assert.deepEqual(worker.opened, ['gtg-share']);
    const id = response.headers.get('location').match(/^https:\/\/example\.test\/app\/#\/share\/(\d+-[a-z0-9]+)$/)[1];
    assert.deepEqual([...worker.store.keys()], [`share/${id}/0`, `share/${id}/1`]);
    const first = worker.store.get(`share/${id}/0`);
    assert.equal(first.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(decodeURIComponent(first.headers.get('X-File-Name')), 'a b.jpg');
    assert.equal(await first.text(), 'one');
    assert.equal(worker.store.get(`share/${id}/1`).headers.get('Content-Type'), 'image/png');
});

test('a share POST with no image redirects to the share screen and keeps nothing', async () => {
    const { worker, response } = await share([new File(['note'], 'note.txt', { type: 'text/plain' })]);
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /#\/share\/\d+-[a-z0-9]+$/);
    assert.equal(worker.store.size, 0);
});

test('a share that fails still redirects to the share screen and keeps nothing', async () => {
    const { worker, response } = await share([], undefined, async () => { throw new Error('quota'); });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /#\/share\/\d+-[a-z0-9]+$/);
    assert.equal(worker.store.size, 0);
});

test('a share that fails after one photo was kept deletes that photo', async () => {
    const worker = loadWorker([], { failPutAt: 2 });
    const form = new FormData();
    form.append('photos', new File(['one'], 'a.jpg', { type: 'image/jpeg' }));
    form.append('photos', new File(['two'], 'b.jpg', { type: 'image/jpeg' }));
    let answer;
    worker.listeners.fetch({ request: { method: 'POST', url: 'https://example.test/app/share-target', formData: async () => form }, respondWith: p => { answer = p; } });
    assert.equal((await answer).status, 303);
    assert.equal(worker.store.size, 0);
});

test('a POST to another address is not a share', () => {
    const worker = loadWorker();
    let answered = false;
    worker.listeners.fetch({ request: { method: 'POST', url: 'https://example.test/app/other' }, respondWith: () => { answered = true; } });
    assert.equal(answered, false);
});

test('activate keeps the gtg-share cache', async () => {
    const worker = loadWorker(['gtg-0.1.0', 'gtg-share', `gtg-${VERSION}`, 'other']);
    let done;
    worker.listeners.activate({ waitUntil: p => { done = p; } });
    await done;
    assert.deepEqual(worker.deleted, ['gtg-0.1.0']);
});

test('the manifest has the share target for images', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(APP, 'manifest.webmanifest'), 'utf8'));
    assert.deepEqual(manifest.share_target, {
        action: './share-target',
        method: 'POST',
        enctype: 'multipart/form-data',
        params: { files: [{ name: 'photos', accept: ['image/*'] }] }
    });
});
