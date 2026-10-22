import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setList, setBlock, setFlag, setFields } from '../app/js/frontmatter-write.js';
import { parseFrontmatter } from '../app/js/frontmatter.js';
import { linkItems, linkProblem, ALLOWED_LINK_PROTOCOLS } from '../app/js/links.js';

const parse = raw => parseFrontmatter(`---\n${raw}\n---\n`);

// The front matter of src/links/index.md in the Vanilla Gorilla template (version 3).
const SAMPLE = [
    'title: Vanilla Gorilla Links',
    'description: Find Vanilla Gorilla around the web.',
    'skeleton: links',
    'draft: true',
    'sitemap: false',
    'image: ./images/logo.png',
    'image_alt: Vanilla Gorilla logo',
    'css: |',
    '  .links-page {',
    '    --links-max-width: 440px;',
    '  }',
    'links:',
    '  - url: https://github.com/exhibita/vanilla-gorilla',
    '    text: Vanilla Gorilla on GitHub',
    '  - url: https://gorillatogo.app',
    '    text: Manage your Vanilla Gorilla content',
    '  - url: https://vg.exhibita.com',
    '    text: See the Vanilla Gorilla sample site'
].join('\n');

// ---------- Writing the front matter of a links page ----------

test('the template sample stays byte for byte the same when nothing changes', () => {
    const data = parse(SAMPLE).data;
    let raw = setFields(SAMPLE, { title: data.title, description: data.description, image: data.image, image_alt: data.image_alt });
    raw = setList(raw, 'links', linkItems(data));
    raw = setFlag(raw, 'sitemap', false);
    raw = setBlock(raw, 'css', data.css);
    assert.equal(raw, SAMPLE);
});

test('setList writes the links: list in quotes and changes only that block', () => {
    const links = [...linkItems(parse(SAMPLE).data)].reverse();
    links.push({ url: 'mailto:me@example.com', text: 'Mail: me' });
    const raw = setList(SAMPLE, 'links', links);
    assert.equal(raw.split('links:')[0], SAMPLE.split('links:')[0]);
    assert.ok(raw.endsWith('  - url: "mailto:me@example.com"\n    text: "Mail: me"'));
    assert.deepEqual(parse(raw).data.links, links);
});

test('setList adds the key when there is none, and an empty list writes an empty key', () => {
    assert.equal(setList('title: T\nskeleton: links', 'links', [{ url: 'https://a.com', text: 'A' }]),
        'title: T\nskeleton: links\nlinks:\n  - url: "https://a.com"\n    text: "A"');
    assert.equal(setList('title: T\nlinks:\n  - url: https://a.com\n    text: A\nskeleton: links', 'links', []),
        'title: T\nlinks:\nskeleton: links');
    assert.equal(setList('title: T', 'links', []), 'title: T');
});

test('setBlock writes CSS as a | block that reads back the same', () => {
    const css = '.links-page {\n  --links-max-width: 400px;\n}\n\n.link-button { color: red; }';
    const raw = setBlock(SAMPLE, 'css', css);
    assert.ok(raw.includes('css: |\n  .links-page {\n    --links-max-width: 400px;\n  }\n\n  .link-button { color: red; }\nlinks:'));
    assert.equal(parse(raw).data.css, css);
    assert.deepEqual(parse(raw).data.links, parse(SAMPLE).data.links);
});

test('setBlock uses an indent digit when the first line starts with a space', () => {
    const raw = setBlock('title: T', 'css', '  a { }\nb { }');
    assert.equal(raw, 'title: T\ncss: |2\n    a { }\n  b { }');
    assert.equal(parse(raw).data.css, '  a { }\nb { }');
});

test('setBlock removes the key when the text is empty, and ignores trailing blank lines', () => {
    assert.equal(setBlock(SAMPLE, 'css', '  \n').includes('css:'), false);
    assert.equal(setBlock(SAMPLE, 'css', `${parse(SAMPLE).data.css}\n\n`), SAMPLE);
});

test('setFlag writes key: true, removes the key for false, and keeps a value that means the same', () => {
    const on = setFlag(SAMPLE, 'sitemap', true);
    assert.ok(on.includes('\nsitemap: true\n'));
    assert.equal(on.includes('sitemap: false'), false);
    assert.equal(setFlag(on, 'sitemap', false).includes('sitemap'), false);
    assert.equal(setFlag('title: T\nsitemap: "TRUE"', 'sitemap', true), 'title: T\nsitemap: "TRUE"');
    assert.equal(setFlag('title: T', 'sitemap', false), 'title: T');
});

test('setFields sets and removes image and image_alt', () => {
    const raw = setFields(SAMPLE, { image: './images/page/links/me.jpg', image_alt: '' });
    assert.equal(parse(raw).data.image, './images/page/links/me.jpg');
    assert.equal(Object.hasOwn(parse(raw).data, 'image_alt'), false);
});

// ---------- Rules for the links (as build.js linkItems) ----------

test('the allowed protocols are the ones that build.js accepts', () => {
    assert.deepEqual([...ALLOWED_LINK_PROTOCOLS].sort(), ['http:', 'https:', 'mailto:', 'sms:', 'tel:']);
});

test('linkProblem accepts a full URL with an allowed protocol and a text', () => {
    for (const url of ['https://example.com', 'http://example.com/a?b=c#d', 'mailto:me@example.com', 'tel:+15551234567', 'sms:+15551234567', '  https://example.com  ']) {
        assert.equal(linkProblem({ url, text: 'Text' }), null, url);
    }
    assert.equal(linkProblem({ url: 'https://example.com', text: 42 }), null, 'a number is text, as in the build');
});

test('linkProblem refuses a link without text or without a URL', () => {
    assert.match(linkProblem({ url: 'https://example.com', text: '  ' }), /text/i);
    assert.match(linkProblem({ url: 'https://example.com' }), /text/i);
    assert.match(linkProblem({ url: '', text: 'A' }), /address/i);
    assert.match(linkProblem({ text: 'A' }), /address/i);
});

test('linkProblem refuses an address without a protocol: the user types the full URL', () => {
    for (const url of ['example.com', 'instagram.com/me', '/page/', '//example.com', './images/a.png']) {
        assert.equal(linkProblem({ url, text: 'A' }), 'Type the full address, with https:// at the start.', url);
    }
});

test('linkProblem refuses a protocol that the build does not accept', () => {
    for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'ftp://example.com', 'file:///etc/passwd']) {
        assert.equal(linkProblem({ url, text: 'A' }), 'The site does not accept this kind of address. Use a web address, or a mailto:, tel: or sms: address.', url);
    }
});

test('linkItems gives a copy of the list, and an empty list for no list', () => {
    const data = parse(SAMPLE).data;
    const items = linkItems(data);
    assert.deepEqual(items, data.links);
    items[0].text = 'Changed';
    assert.notEqual(data.links[0].text, 'Changed');
    assert.deepEqual(linkItems({}), []);
    assert.deepEqual(linkItems({ links: null }), []);
    assert.deepEqual(linkItems({ links: 'not a list' }), []);
});
