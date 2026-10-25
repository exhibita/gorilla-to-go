import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readShare, deleteShare, pruneShares } from '../app/js/share-store.js';

const BASE = 'https://example.test/app/';

// A small fake of the Cache API: one cache, keys are URLs.
function fakeCaches() {
    const entries = new Map();
    const cache = {
        keys: async () => [...entries.keys()].map(url => ({ url })),
        match: async request => entries.get(typeof request === 'string' ? request : request.url),
        delete: async request => entries.delete(request.url),
        put: async (key, response) => { entries.set(BASE + key, response); }
    };
    return { entries, caches: { open: async () => cache } };
}

async function addFile(cache, key, name, type, text) {
    await cache.put(key, new Response(text, { headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(name) } }));
}

test('readShare returns the files in order with their names and types', async () => {
    const { caches } = fakeCaches();
    const cache = await caches.open();
    await addFile(cache, 'share/100-a/1', 'b é.png', 'image/png', 'two');
    await addFile(cache, 'share/100-a/0', 'a.jpg', 'image/jpeg', 'one');
    await addFile(cache, 'share/200-b/0', 'other.jpg', 'image/jpeg', 'other');
    const files = await readShare('100-a', caches);
    assert.deepEqual(files.map(f => [f.name, f.type]), [['a.jpg', 'image/jpeg'], ['b é.png', 'image/png']]);
    assert.equal(await files[0].text(), 'one');
    assert.equal(await files[1].text(), 'two');
});

test('deleteShare removes every entry of the share', async () => {
    const { caches, entries } = fakeCaches();
    const cache = await caches.open();
    await addFile(cache, 'share/100-a/0', 'a.jpg', 'image/jpeg', 'one');
    await addFile(cache, 'share/100-a/1', 'b.jpg', 'image/jpeg', 'two');
    await addFile(cache, 'share/200-b/0', 'c.jpg', 'image/jpeg', 'three');
    await deleteShare('100-a', caches);
    assert.deepEqual([...entries.keys()], [BASE + 'share/200-b/0']);
});

test('pruneShares deletes only the shares older than one day', async () => {
    const { caches, entries } = fakeCaches();
    const cache = await caches.open();
    const now = 10 * 86400000;
    await addFile(cache, `share/${now - 86400000 - 1}-old/0`, 'a.jpg', 'image/jpeg', 'old');
    await addFile(cache, `share/${now - 86400000}-edge/0`, 'b.jpg', 'image/jpeg', 'edge');
    await addFile(cache, `share/${now - 1000}-new/0`, 'c.jpg', 'image/jpeg', 'new');
    await pruneShares(now, caches);
    assert.deepEqual([...entries.keys()].map(k => k.split('-').pop().split('/')[0]), ['edge', 'new']);
});
