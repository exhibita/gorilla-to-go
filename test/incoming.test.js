import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setIncoming, takeIncoming } from '../app/js/incoming.js';

const entry = () => ({ siteId: 's1', path: 'gallery.md', files: [{ name: 'a.jpg' }], origins: [null] });

test('takeIncoming returns the entry once, and only for the same site and path', () => {
    const e = entry();
    setIncoming(e);
    assert.equal(takeIncoming('s2', 'gallery.md'), null);
    assert.equal(takeIncoming('s1', 'other.md'), null);
    assert.equal(takeIncoming('s1', 'gallery.md'), e);
    assert.equal(takeIncoming('s1', 'gallery.md'), null);
});

test('setIncoming replaces an earlier entry', () => {
    setIncoming(entry());
    const second = { ...entry(), path: 'two.md' };
    setIncoming(second);
    assert.equal(takeIncoming('s1', 'gallery.md'), null);
    assert.equal(takeIncoming('s1', 'two.md'), second);
});
