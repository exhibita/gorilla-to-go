import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aboutSheetHtml } from '../app/js/screens/about.js';
import { VERSION } from '../app/js/version.js';

const html = aboutSheetHtml();

test('the About sheet shows the name and the version of the app', () => {
    assert.match(html, /About Gorilla To Go/);
    assert.ok(html.includes(`Version ${VERSION}`), 'no version');
});

test('the About sheet says what the app is for, and shows the license and the source', () => {
    assert.match(html, /Vanilla Gorilla/);
    assert.match(html, /AGPL-3\.0-or-later/);
    assert.match(html, /href="https:\/\/github\.com\/exhibita\/gorilla-to-go"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});

test('the About sheet links to the help pages inside the app', () => {
    assert.match(html, /href="#\/help\/token"/);
    assert.match(html, /href="#\/help\/upgrade"/);
});

test('the About sheet is a dialog with a Close button', () => {
    assert.match(html, /^\s*<dialog class="sheet" id="about"/);
    assert.match(html, /data-close>Close</);
});
