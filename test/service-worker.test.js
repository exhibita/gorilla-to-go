import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP, appFiles } from './helpers.js';
import { VERSION } from '../app/js/version.js';
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('the service worker precaches every app file, so the app opens offline', () => {
    // CNAME is for GitHub Pages only. The app does not load it.
    const files = appFiles().filter(f => f !== 'sw.js' && f !== 'CNAME');
    for (const file of files) {
        assert.ok(assets.includes(file), `${file} is not in ASSETS in sw.js`);
    }
});

test('every precached file exists', () => {
    for (const asset of assets.filter(a => a !== './')) {
        assert.ok(fs.existsSync(path.join(APP, asset)), `${asset} is in ASSETS but does not exist`);
    }
});

test('the cache name changes with the app version, so an update replaces the old files', () => {
    assert.match(sw, new RegExp(`const VERSION = '${VERSION.replace(/\./g, '\\.')}';`));
});

test('the service worker does not cache GitHub API responses', () => {
    assert.match(sw, /url\.origin !== self\.location\.origin/);
});
