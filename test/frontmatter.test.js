import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, isDraft } from '../app/js/frontmatter.js';

const page = (yaml, body = '\nBody text.\n') => `---\n${yaml}\n---\n${body}`;

test('plain scalars, quoted strings, dates, booleans and numbers', () => {
    const { data, body, error } = parseFrontmatter(page([
        'title: Cost & Performance Wins with AWS Static Hosting',
        'date: 2026-07-15',
        'description: "Two images from the images: list."',
        "subtitle: 'It''s here'",
        'draft: true',
        'order: 3',
        'skeleton: blog'
    ].join('\n')));
    assert.equal(error, null);
    assert.deepEqual(data, {
        title: 'Cost & Performance Wins with AWS Static Hosting',
        date: '2026-07-15',
        description: 'Two images from the images: list.',
        subtitle: "It's here",
        draft: true,
        order: 3,
        skeleton: 'blog'
    });
    assert.equal(body, '\nBody text.\n');
});

test('double-quoted strings keep escapes and colons', () => {
    const { data } = parseFrontmatter(page('title: "GitHub Pages vs. AWS: \\"Choosing\\""'));
    assert.equal(data.title, 'GitHub Pages vs. AWS: "Choosing"');
});

test('an images: list of maps (decision 21)', () => {
    const { data, error } = parseFrontmatter(page([
        'title: Test gallery',
        'images:',
        '  - path: ./images/gallery/test-gallery/one.png',
        '    alt: First test image',
        '    caption: One',
        '  - path: ./images/gallery/test-gallery/two.png',
        '    alt: Second test image',
        '    caption: Two & more'
    ].join('\n')));
    assert.equal(error, null);
    assert.deepEqual(data.images, [
        { path: './images/gallery/test-gallery/one.png', alt: 'First test image', caption: 'One' },
        { path: './images/gallery/test-gallery/two.png', alt: 'Second test image', caption: 'Two & more' }
    ]);
});

test('a list of scalars, an empty key and comments', () => {
    const { data, error } = parseFrontmatter(page([
        '# A comment',
        'tags:',
        '- one',
        '- "two: quoted"',
        'images:',
        'title: After an empty key # trailing comment'
    ].join('\n')));
    assert.equal(error, null);
    assert.deepEqual(data, { tags: ['one', 'two: quoted'], images: null, title: 'After an empty key' });
});

test('block scalars with | and >', () => {
    const { data } = parseFrontmatter(page([
        'description: >',
        '  First line',
        '  second line.',
        'notes: |',
        '  Line one',
        '  Line two',
        'title: Next'
    ].join('\n')));
    assert.equal(data.description, 'First line second line.');
    assert.equal(data.notes, 'Line one\nLine two');
    assert.equal(data.title, 'Next');
});

test('Windows line endings and a byte order mark', () => {
    const { data, body } = parseFrontmatter('﻿---\r\ntitle: Windows\r\ndate: 2026-01-02\r\n---\r\nBody\r\n');
    assert.deepEqual(data, { title: 'Windows', date: '2026-01-02' });
    assert.equal(body, 'Body\r\n');
});

test('a file without front matter has empty data and the whole text as body', () => {
    const { data, body, raw, error } = parseFrontmatter('# Just Markdown\n');
    assert.deepEqual(data, {});
    assert.equal(body, '# Just Markdown\n');
    assert.equal(raw, '');
    assert.equal(error, null);
});

test('front matter the parser cannot read gives an error, keeps the body, and does not throw', () => {
    for (const yaml of ['title: [unclosed', 'nested:\n  key: value', 'title: "no end quote', '  indented: first line']) {
        const result = parseFrontmatter(page(yaml));
        assert.ok(result.error, `no error for ${JSON.stringify(yaml)}`);
        assert.equal(result.body, '\nBody text.\n');
        assert.equal(result.raw, yaml);
    }
});

test('an unclosed front matter block is treated as body text', () => {
    const result = parseFrontmatter('---\ntitle: No end\n\nBody');
    assert.deepEqual(result.data, {});
    assert.equal(result.body, '---\ntitle: No end\n\nBody');
    assert.ok(result.error);
});

test('isDraft accepts true and the string "true" in any case (decision 22)', () => {
    assert.equal(isDraft({ draft: true }), true);
    assert.equal(isDraft({ draft: 'TRUE' }), true);
    assert.equal(isDraft({ draft: false }), false);
    assert.equal(isDraft({ draft: 'yes' }), false);
    assert.equal(isDraft({}), false);
    assert.equal(isDraft(null), false);
});

// Checked against gray-matter, the parser of build.js: it refuses all of these except the anchor,
// which this parser cannot read.
test('YAML that the site build refuses, or that the app cannot read, is an error', () => {
    const refused = [
        'title: Recipe: Pasta',             // ": " in a plain value
        'title: *alias',                    // an alias
        'title: &anchor value',             // an anchor
        'title: !tag value',                // a tag
        'title: @handle',                   // a reserved character
        'title: `code`',                    // a reserved character
        'title: One\ntitle: Two'            // a duplicated key
    ];
    for (const yaml of refused) {
        assert.ok(parseFrontmatter(page(yaml)).error, `accepted ${JSON.stringify(yaml)}`);
    }
});

test('a colon without a space after it, and a URL, are plain text', () => {
    const { data, error } = parseFrontmatter(page('time: 10:30\nlink: https://example.com/a#b\nratio: a:b'));
    assert.equal(error, null);
    assert.deepEqual(data, { time: '10:30', link: 'https://example.com/a#b', ratio: 'a:b' });
});

test('a | or > block inside an images: entry is an error, not wrong data', () => {
    const result = parseFrontmatter(page('images:\n  - path: ./a.jpg\n    caption: |\n      Note: this is it'));
    assert.ok(result.error);
});

test('a tab in an indent is read, as the site build does', () => {
    const { data, error } = parseFrontmatter(page('images:\n\t- path: ./a.jpg'));
    assert.equal(error, null);
    assert.deepEqual(data.images, [{ path: './a.jpg' }]);
});
