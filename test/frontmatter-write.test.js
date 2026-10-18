import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { splitPage, composePage, yamlText, setFields, editedBody } from '../app/js/frontmatter-write.js';
import { parseFrontmatter } from '../app/js/frontmatter.js';

const SAMPLES = [
    '---\ntitle: Hello\ndate: 2026-01-01\n---\n\nBody text.\n',
    '---\r\ntitle: Windows\r\n---\r\nBody\r\n',
    '﻿---\ntitle: With BOM\n---\nBody',
    '# No front matter\n\nJust text.\n',
    '---\ntitle: "Quoted: yes"\n# a comment\nnotes: |\n  line one\n  line two\nimages:\n  - path: ./a.jpg\n    caption: A\n---\nBody\n',
    '---\n---\nEmpty front matter\n',
    '---\ntitle: No body\n---\n',
    ''
];

test('split then compose gives the same text, byte for byte', () => {
    for (const text of SAMPLES) {
        assert.equal(composePage(splitPage(text)), text, JSON.stringify(text));
    }
});

test('split then compose gives the same text for every real page in the local sites', () => {
    const walk = dir => fs.existsSync(dir)
        ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [])
        : [];
    const files = ['../gtg-test-site/src', '../vanilla-gorilla/src', '../exhibita-static-site/src'].flatMap(walk);
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        assert.equal(composePage(splitPage(text)), text, file);
    }
});

test('splitPage finds the line ending, the BOM and the parts', () => {
    assert.deepEqual(splitPage('﻿---\r\ntitle: X\r\n---\r\nBody'), {
        bom: '﻿', eol: '\r\n', raw: 'title: X', body: 'Body', hasFrontmatter: true, open: '---\r\n', close: '---\r\n', rawExact: 'title: X\r\n', fmEol: '\r\n'
    });
    assert.deepEqual(splitPage('Just text\n'), {
        bom: '', eol: '\n', raw: '', body: 'Just text\n', hasFrontmatter: false, open: '---\n', close: '---\n', rawExact: '', fmEol: '\n'
    });
    assert.equal(splitPage('---\ntitle: X\n---\r\nBody\r\n').eol, '\r\n', 'the body line ending, not the front matter one');
    assert.equal(splitPage('---\ntitle: X\n---\r\nBody\r\n').fmEol, '\n');
    assert.equal(splitPage('---\ntitle: X\n---').close, '---', 'a closing line at the end of the file keeps having no line break');
});

test('yamlText writes double-quoted text that reads back the same', () => {
    const values = ['Plain', 'Recipe: "Pasta" & more', 'Back\\slash', 'Hash # tag', 'Two\nlines', "It's", '  spaces  ', '*star', 'Tab\there', 'Café ✓'];
    for (const value of values) {
        const { data, error } = parseFrontmatter(`---\ntitle: ${yamlText(value)}\n---\n`);
        assert.equal(error, null, `${JSON.stringify(value)} → ${yamlText(value)}`);
        assert.equal(data.title, value);
    }
});

test('setFields changes only the edited lines and keeps the rest', () => {
    const raw = 'title: Old\n# keep this comment\ndate: 2026-01-01\nskeleton: blog\nimages:\n  - path: ./a.jpg';
    assert.equal(
        setFields(raw, { title: 'New: title', date: '2026-02-03', description: 'Short text' }),
        'title: "New: title"\n# keep this comment\ndate: 2026-02-03\nskeleton: blog\nimages:\n  - path: ./a.jpg\ndescription: "Short text"'
    );
});

test('setFields keeps a line that did not change, even when it is not quoted', () => {
    const raw = 'title: Same\ndate: 2026-01-01\ndescription: Not quoted';
    assert.equal(setFields(raw, { title: 'Same', date: '2026-01-01', description: 'Not quoted' }), raw);
});

test('setFields removes the description when it is empty, and replaces a block value', () => {
    const raw = 'title: T\ndescription: >\n  Old long\n  text\nskeleton: page';
    assert.equal(setFields(raw, { title: 'T', date: '', description: '' }), 'title: T\nskeleton: page');
    assert.equal(setFields(raw, { title: 'T', date: '', description: 'New' }), 'title: T\ndescription: "New"\nskeleton: page');
});

test('setFields adds front matter fields to an empty block', () => {
    assert.equal(setFields('', { title: 'New page', date: '2026-10-18', description: '' }), 'title: "New page"\ndate: 2026-10-18');
});

test('an edited page composes to valid front matter', () => {
    const parts = splitPage('---\r\ntitle: Old\r\nskeleton: blog\r\n---\r\nBody\r\n');
    const text = composePage({ ...parts, raw: setFields(parts.raw, { title: 'A "new" title', date: '2026-10-18', description: '' }) });
    assert.equal(text, '---\r\ntitle: "A \\"new\\" title"\r\nskeleton: blog\r\ndate: 2026-10-18\r\n---\r\nBody\r\n');
    assert.deepEqual(parseFrontmatter(text).data, { title: 'A "new" title', skeleton: 'blog', date: '2026-10-18' });
});

test('a page without front matter gets a block when a field is set', () => {
    const parts = splitPage('Body only\n');
    assert.equal(composePage({ ...parts, raw: setFields(parts.raw, { title: 'T', date: '', description: '' }), hasFrontmatter: true }), '---\ntitle: "T"\n---\nBody only\n');
});

test('mixed line endings round-trip: LF front matter with a CRLF body, and the reverse', () => {
    for (const text of ['---\ntitle: X\n---\r\nBody\r\nMore\r\n', '---\r\ntitle: X\r\n---\nBody\nMore\n', '---\ntitle: X\n---\nA\r\nB\nC\r\n']) {
        assert.equal(composePage(splitPage(text)), text, JSON.stringify(text));
    }
});

test('editedBody gives back the original bytes when the textarea text did not change', () => {
    const original = 'A\r\nB\nC\rD\r\n';
    const inTextarea = original.replace(/\r\n?/g, '\n'); // What a textarea shows.
    assert.equal(editedBody(inTextarea, original, '\r\n'), original);
    assert.equal(editedBody(`${inTextarea}E\n`, original, '\r\n'), 'A\r\nB\r\nC\r\nD\r\nE\r\n');
});
