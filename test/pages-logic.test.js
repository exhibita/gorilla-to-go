import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, pageSummary, sortPages, filterPages, formatDate, TYPE_LABELS } from '../app/js/pages-logic.js';
import { parseFrontmatter } from '../app/js/frontmatter.js';

test('blog posts and galleries are known by their path', () => {
    assert.deepEqual(classifyPath('src/blog/my-post/index.md'), { type: 'blog', slug: 'my-post' });
    assert.deepEqual(classifyPath('src/gallery/trip/index.md'), { type: 'gallery', slug: 'trip' });
});

test('every other Markdown file under src/ is a page', () => {
    assert.deepEqual(classifyPath('src/privacy/index.md'), { type: 'page', slug: 'privacy' });
    assert.deepEqual(classifyPath('src/products-and-services/software/index.md'), { type: 'page', slug: 'products-and-services/software' });
    assert.deepEqual(classifyPath('src/notes.md'), { type: 'page', slug: 'notes' });
    assert.deepEqual(classifyPath('src/blog/author/index.md'), { type: 'page', slug: 'blog/author' });
    assert.deepEqual(classifyPath('src/blog/a/b/index.md'), { type: 'page', slug: 'blog/a/b' });
});

test('templates, skeletons, HTML files and files outside src/ are not pages', () => {
    for (const path of ['src/templates/x.md', 'src/skeletons/readme.md', 'src/index.html', 'README.md', 'docs/UPGRADE-v2.md', 'src/blog/x/index.MD.bak']) {
        assert.equal(classifyPath(path), null, path);
    }
});

test('pageSummary reads the title, date, draft flag and image count', () => {
    const fm = parseFrontmatter('---\ntitle: Trip\ndate: 2026-05-01\ndraft: "true"\nimages:\n  - path: ./a.jpg\n  - path: ./b.jpg\n---\nText');
    assert.deepEqual(pageSummary('src/gallery/trip/index.md', 'abc', fm), {
        path: 'src/gallery/trip/index.md', sha: 'abc', type: 'gallery', slug: 'trip',
        title: 'Trip', date: '2026-05-01', draft: true, imageCount: 2, error: null
    });
});

test('pageSummary uses the slug when the title is missing or the front matter has an error', () => {
    const bad = parseFrontmatter('---\ntitle: [x\n---\nText');
    const summary = pageSummary('src/blog/my-post/index.md', 'abc', bad);
    assert.equal(summary.title, 'my-post');
    assert.ok(summary.error);
    assert.equal(pageSummary('src/x/index.md', 's', parseFrontmatter('No front matter')).title, 'x');
});

test('pageSummary ignores a date that is not YYYY-MM-DD', () => {
    assert.equal(pageSummary('src/x/index.md', 's', parseFrontmatter('---\ntitle: X\ndate: next week\n---\n')).date, null);
});

test('pages sort newest first, undated last by title (as build.js does)', () => {
    const pages = [
        { title: 'Terms of Service', date: null },
        { title: 'Old', date: '2025-01-01' },
        { title: 'Privacy Policy', date: null },
        { title: 'New', date: '2026-10-17' }
    ];
    assert.deepEqual(sortPages(pages).map(p => p.title), ['New', 'Old', 'Privacy Policy', 'Terms of Service']);
});

test('filterPages selects one type and searches title and slug, ignoring case', () => {
    const pages = [
        { type: 'blog', title: 'Hello World', slug: 'hello' },
        { type: 'page', title: 'Privacy Policy', slug: 'privacy' },
        { type: 'gallery', title: 'Beach Trip', slug: 'summer-2026' }
    ];
    assert.deepEqual(filterPages(pages, { type: 'all', query: '' }).length, 3);
    assert.deepEqual(filterPages(pages, { type: 'gallery', query: '' }).map(p => p.slug), ['summer-2026']);
    assert.deepEqual(filterPages(pages, { type: 'all', query: 'PRIVACY' }).map(p => p.slug), ['privacy']);
    assert.deepEqual(filterPages(pages, { type: 'all', query: 'summer' }).map(p => p.slug), ['summer-2026']);
    assert.deepEqual(filterPages(pages, { type: 'blog', query: 'beach' }), []);
});

test('formatDate shows the date in UTC, so it is not one day early in the US', () => {
    assert.equal(formatDate('2026-10-17'), 'Oct 17, 2026');
    assert.equal(formatDate('2026-01-01'), 'Jan 1, 2026');
    assert.equal(formatDate(null), '');
});

test('type labels match design.md', () => {
    assert.deepEqual(TYPE_LABELS, { blog: 'Blog', page: 'Page', gallery: 'Gallery' });
});
