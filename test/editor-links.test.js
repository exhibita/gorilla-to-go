// The parts of the Links view that the editor uses. They make DOM nodes, so they run in jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = window.document;
const { linkListItems, previewLinks, firstLinkProblem, linkSheetHtml, linksViewHtml } = await import('../app/js/screens/editor-links.js');

const LINKS = [
    { url: 'https://example.com', text: 'Example' },
    { url: 'example.org', text: 'No protocol' },
    { url: 'javascript:alert(1)', text: '<b>Script</b>' },
    'not a link'
];

test('the list has one button per item, and marks the links that the site skips', () => {
    const opened = [];
    const items = linkListItems(LINKS, index => opened.push(index));
    assert.equal(items.length, 4);
    assert.equal(items[0].querySelector('.link-row-text').textContent, 'Example');
    assert.equal(items[0].querySelector('.photo-mark'), null);
    assert.ok(items[1].querySelector('.photo-mark--warn'));
    assert.match(items[1].querySelector('button').getAttribute('aria-label'), /skips this link: Type the full address/);
    assert.equal(items[2].querySelector('.link-row-text').textContent, '<b>Script</b>', 'text, not HTML');
    assert.equal(items[2].querySelector('b'), null);
    assert.ok(items[3].querySelector('.photo-mark--warn'));
    items[2].querySelector('button').click();
    assert.deepEqual(opened, [2]);
});

test('the Preview shows only the links that the site builds, in order, and they do not open', () => {
    const list = previewLinks([{ url: 'https://b.com', text: 'B' }, ...LINKS, { url: 'tel:+1555', text: 'Call' }]);
    assert.deepEqual([...list.children].map(child => child.textContent), ['B', 'Example', 'Call']);
    assert.equal(list.querySelector('a'), null);
});

test('firstLinkProblem names the first link that the site skips, or gives null', () => {
    assert.equal(firstLinkProblem(LINKS.slice(0, 1)), null);
    assert.equal(firstLinkProblem([]), null);
    assert.equal(firstLinkProblem(LINKS), 'Link 2 (No protocol): Type the full address, with https:// at the start.');
    assert.equal(firstLinkProblem([{ url: 'https://a.com' }]), 'Link 1 (no text): Type the text of the button.');
});

test('the address field does not change what the user types (no capital letters, no corrections)', () => {
    const sheet = new JSDOM(linkSheetHtml()).window.document;
    const url = sheet.querySelector('#link-url');
    assert.equal(url.getAttribute('autocapitalize'), 'off');
    assert.equal(url.getAttribute('autocorrect'), 'off');
    assert.equal(url.getAttribute('spellcheck'), 'false');
    assert.ok(new JSDOM(linksViewHtml()).window.document.querySelector('#add-link'));
});
