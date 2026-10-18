import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, slugProblem, pagePath, localDate, newPageText, NEW_PAGE_TYPES } from '../app/js/new-page.js';
import { parseFrontmatter } from '../app/js/frontmatter.js';
import { classifyPath } from '../app/js/pages-logic.js';

test('slugify makes a lowercase address from the title', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
    assert.equal(slugify('  Recipe: "Pasta" & more!  '), 'recipe-pasta-more');
    assert.equal(slugify('Café déjà vu – Ñandú'), 'cafe-deja-vu-nandu');
    assert.equal(slugify('2026 Plans 🦍 & Goals'), '2026-plans-goals');
    assert.equal(slugify("It's the cat's"), 'its-the-cats');
});

test('slugify gives an empty text when the title has no letters or digits', () => {
    assert.equal(slugify('🦍 & !!!'), '');
    assert.equal(slugify(''), '');
});

test('slugify keeps addresses short, without a dash at the end', () => {
    const slug = slugify('word '.repeat(40));
    assert.ok(slug.length <= 60, slug);
    assert.doesNotMatch(slug, /-$/);
});

test('pagePath puts each type in its folder (vanilla-gorilla-notes)', () => {
    assert.equal(pagePath('blog', 'my-post'), 'src/blog/my-post/index.md');
    assert.equal(pagePath('gallery', 'trip'), 'src/gallery/trip/index.md');
    assert.equal(pagePath('page', 'about'), 'src/about/index.md');
    for (const type of NEW_PAGE_TYPES.map(t => t.type)) {
        assert.equal(classifyPath(pagePath(type, 'x')).type, type, 'the list shows the new page with the same type');
    }
});

test('slugProblem refuses an empty or badly formed address', () => {
    assert.equal(slugProblem('', { type: 'blog', existingPaths: [] }), 'Type an address.');
    for (const bad of ['Hello', 'two words', '-start', 'end-', 'a--b', 'a/b', 'ä']) {
        assert.equal(slugProblem(bad, { type: 'blog', existingPaths: [] }), 'Use only small letters (a to z), digits and single dashes.', bad);
    }
    assert.equal(slugProblem('ok-slug-2', { type: 'blog', existingPaths: [] }), null);
});

test('slugProblem refuses an address that a page uses already', () => {
    const existingPaths = ['src/blog/hello/index.md', 'src/about/index.md', 'src/products/software/index.md'];
    assert.equal(slugProblem('hello', { type: 'blog', existingPaths }), 'A page with this address exists. Use a different address.');
    assert.equal(slugProblem('about', { type: 'page', existingPaths }), 'A page with this address exists. Use a different address.');
    assert.equal(slugProblem('products', { type: 'page', existingPaths }), 'A page with this address exists. Use a different address.');
    assert.equal(slugProblem('hello', { type: 'page', existingPaths }), null, 'a page at /hello/ is not the blog post /blog/hello/');
});

test('slugProblem refuses a page address that is a folder of the site', () => {
    for (const folder of ['blog', 'gallery', 'images', 'css', 'js', 'templates', 'skeletons', 'fonts']) {
        assert.equal(slugProblem(folder, { type: 'page', existingPaths: [] }), 'The site uses this address for its own files. Use a different address.', folder);
    }
    assert.equal(slugProblem('images', { type: 'blog', existingPaths: [] }), null, '/blog/images/ is fine');
});

test('localDate uses the date of the device, not the UTC date', () => {
    // 23:30 on Oct 18 in the device time zone stays Oct 18.
    assert.equal(localDate(new Date(2026, 9, 18, 23, 30)), '2026-10-18');
    assert.equal(localDate(new Date(2026, 0, 5, 0, 10)), '2026-01-05');
});

test('newPageText writes valid front matter with title, date, description and skeleton', () => {
    const text = newPageText({ title: 'Recipe: "Pasta" & more', date: '2026-10-18', description: 'Short: text', type: 'blog' });
    assert.equal(text, '---\ntitle: "Recipe: \\"Pasta\\" & more"\ndate: 2026-10-18\ndescription: "Short: text"\nskeleton: blog\n---\n\n');
    const { data, error } = parseFrontmatter(text);
    assert.equal(error, null);
    assert.deepEqual(data, { title: 'Recipe: "Pasta" & more', date: '2026-10-18', description: 'Short: text', skeleton: 'blog' });
});

test('newPageText leaves out an empty description, and uses the skeleton of each type', () => {
    assert.equal(newPageText({ title: 'About', date: '2026-10-18', description: '', type: 'page' }), '---\ntitle: "About"\ndate: 2026-10-18\nskeleton: page\n---\n\n');
    assert.match(newPageText({ title: 'Trip', date: '2026-10-18', description: '', type: 'gallery' }), /skeleton: gallery\n/);
});
