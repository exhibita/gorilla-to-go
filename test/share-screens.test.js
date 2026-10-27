// The HTML builders of the Share screen, the Inbox screen and the waiting row. They make DOM nodes, so they run in jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { galleryPickerHtml, galleries, shareIntroText } = await import('../app/js/screens/gallery-picker.js');
const { waitingCardHtml, waitingRowHtml } = await import('../app/js/screens/inbox-view.js');

const parse = html => new JSDOM(`<!doctype html><body>${html}</body>`).window.document;

const PAGES = [
    { path: 'src/blog/a/index.md', type: 'blog', title: 'A post' },
    { path: 'src/gallery/one/index.md', type: 'gallery', title: 'One <i>pic</i>' },
    { path: 'src/gallery/two/index.md', type: 'gallery', title: 'Two' },
    { path: 'src/about.md', type: 'page', title: 'About' }
];

test('the gallery picker lists only galleries, and links to New page when there is none', () => {
    assert.deepEqual(galleries(PAGES).map(page => page.path), ['src/gallery/one/index.md', 'src/gallery/two/index.md']);
    const doc = parse(galleryPickerHtml(PAGES, 'site 1'));
    const rows = [...doc.querySelectorAll('button[data-path]')];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].dataset.path, 'src/gallery/one/index.md');
    assert.equal(rows[0].querySelector('i'), null, 'a title shows as text');
    assert.ok(rows[0].querySelector('.type-label--gallery'));
    const none = parse(galleryPickerHtml([PAGES[0]], 'site 1'));
    assert.match(none.body.textContent, /This site has no gallery\./);
    assert.equal(none.querySelector('a').getAttribute('href'), '#/site/site%201/new');
    assert.equal(none.querySelector('button[data-path]'), null);
});

test('a gallery with a front matter error cannot be chosen', () => {
    const doc = parse(galleryPickerHtml([{ ...PAGES[1], error: 'bad' }], 'a'));
    assert.ok(doc.querySelector('button[data-path]').disabled);
    assert.match(doc.body.textContent, /Front matter error/);
});

test('shareIntroText counts the photos, and says when no photos were received', () => {
    assert.equal(shareIntroText(1), 'Add 1 photo to a gallery');
    assert.equal(shareIntroText(3), 'Add 3 photos to a gallery');
    assert.equal(shareIntroText(0), 'No photos were received.');
});

const ITEM = { name: 'a.jpg', path: 'gtg-inbox/a.jpg', sha: 'abc', bytes: new Uint8Array([1, 2, 3]) };

test('a photo card has a Discard button', () => {
    const doc = parse(waitingCardHtml(ITEM));
    const discard = doc.querySelector('button[data-discard]');
    assert.ok(discard);
    assert.equal(discard.dataset.path, 'gtg-inbox/a.jpg');
    assert.equal(discard.dataset.sha, 'abc');
    assert.match(doc.querySelector('img').getAttribute('src'), /^data:image\/jpeg;base64,AQID$/);
    assert.equal(doc.body.textContent.includes('Added, not published'), false);
});

test('a pending photo card says "Added, not published" and has no Add', () => {
    const doc = parse(waitingCardHtml({ ...ITEM, pending: true }));
    assert.match(doc.body.textContent, /Added, not published/);
    assert.equal(doc.querySelector('[data-add]'), null);
    assert.doesNotMatch(doc.body.textContent, /\bAdd to\b/);
});

test('a photo name with HTML shows as text', () => {
    const doc = parse(waitingCardHtml({ ...ITEM, name: '<b>x</b>.jpg' }));
    assert.equal(doc.querySelector('b'), null);
    assert.equal(doc.querySelector('.photo-label').textContent, '<b>x</b>.jpg');
});

test('waitingRowHtml shows "3 photos waiting", and nothing for null or 0', () => {
    const doc = parse(waitingRowHtml(3, 'my site'));
    assert.match(doc.body.textContent, /3 photos waiting/);
    assert.equal(doc.querySelector('a').getAttribute('href'), '#/site/my%20site/inbox');
    assert.match(parse(waitingRowHtml(1, 'a')).body.textContent, /1 photo waiting/);
    assert.equal(waitingRowHtml(0, 'a'), '');
    assert.equal(waitingRowHtml(null, 'a'), '');
});
