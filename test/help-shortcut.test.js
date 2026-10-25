import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SHORTCUT_LINK, SHORTCUT_PAGE } from '../app/js/screens/help-shortcut.js';

const DOC = fs.readFileSync(path.resolve('docs/ios-shortcut.md'), 'utf8');

test('the Shortcut help page shows the setup steps without a link while SHORTCUT_LINK is empty', () => {
    assert.equal(SHORTCUT_LINK, '');
    assert.match(SHORTCUT_PAGE, /Ask the site owner for the Shortcut link\./);
    assert.match(SHORTCUT_PAGE, /<ol>/);
    assert.doesNotMatch(SHORTCUT_PAGE, /Add the Shortcut/);
});

test('the Shortcut help page starts with the history warning, before the setup steps', () => {
    const note = SHORTCUT_PAGE.match(/<div class="banner" role="note">[\s\S]*?<\/div>/);
    assert.ok(note, 'no warning box');
    assert.ok(SHORTCUT_PAGE.indexOf(note[0]) < SHORTCUT_PAGE.indexOf('<ol>'));
    assert.match(note[0], /Your photos stay in the site history/);
    for (const word of ['history', 'public', 'Location', 'Add photos']) assert.ok(note[0].includes(word), word);
});

test('the Shortcut recipe has the warning and tells the user to turn off Preserve Metadata and to remove the token before sharing', () => {
    assert.match(DOC, /stay in the site history/i);
    assert.match(DOC, /Preserve Metadata/);
    assert.match(DOC, /Import Questions/);
});
