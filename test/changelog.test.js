import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VERSION } from '../app/js/version.js';
import { latestEntries, entryHeadings } from '../app/js/changelog.js';
import { RECENT_CHANGES } from '../app/js/changelog-recent.js';
import { getChangelog } from '../app/js/github.js';

const CHANGELOG = fs.readFileSync(path.resolve('CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');

test('the newest changelog entry is the app version, so each release adds an entry', () => {
    assert.equal(entryHeadings(CHANGELOG)[0].version, VERSION);
});

test('each entry has a version and a date, newest first', () => {
    const headings = entryHeadings(CHANGELOG);
    assert.ok(headings.length >= 10);
    const number = version => version.split('.').map(Number).reduce((sum, part) => sum * 1000 + part, 0);
    for (const [i, heading] of headings.entries()) {
        assert.match(heading.date, /^\d{4}-\d{2}-\d{2}$/, heading.version);
        if (i > 0) {
            assert.ok(number(heading.version) < number(headings[i - 1].version), `${heading.version} is after ${headings[i - 1].version}`);
            assert.ok(heading.date <= headings[i - 1].date, `${heading.version} has a later date`);
        }
    }
});

test('the offline copy in the app is the last 3 entries of CHANGELOG.md (run npm run changelog to update it)', () => {
    assert.equal(RECENT_CHANGES, latestEntries(CHANGELOG, 3));
});

test('latestEntries gives the first entries without the title', () => {
    const text = '# Title\n\nIntro.\n\n## 2.0.0 — 2026-01-02\n\n- B\n\n## 1.0.0 — 2026-01-01\n\n- A\n';
    assert.equal(latestEntries(text, 1), '## 2.0.0 — 2026-01-02\n\n- B');
    assert.equal(latestEntries(text, 5), '## 2.0.0 — 2026-01-02\n\n- B\n\n## 1.0.0 — 2026-01-01\n\n- A');
    assert.deepEqual(entryHeadings(text), [{ version: '2.0.0', date: '2026-01-02' }, { version: '1.0.0', date: '2026-01-01' }]);
});

test('getChangelog reads CHANGELOG.md of the app repository, without a token', async () => {
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response('# What is new\n', { status: 200 });
    };
    assert.equal(await getChangelog({ fetch }), '# What is new\n');
    assert.equal(calls[0].url, 'https://api.github.com/repos/exhibita/gorilla-to-go/contents/CHANGELOG.md?ref=main');
    assert.equal(calls[0].init.headers.Accept, 'application/vnd.github.raw+json');
    assert.equal(calls[0].init.headers.Authorization, undefined, 'no token goes to this request');
});

test('getChangelog gives null when it cannot read the changelog', async () => {
    assert.equal(await getChangelog({ fetch: async () => new Response('', { status: 403 }) }), null);
    assert.equal(await getChangelog({ fetch: async () => { throw new TypeError('Failed to fetch'); } }), null);
});
