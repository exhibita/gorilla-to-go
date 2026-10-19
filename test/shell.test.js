import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, APP, appFiles } from './helpers.js';

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('VERSION in app/js/version.js equals the package.json version', async () => {
    const pkg = JSON.parse(read('package.json'));
    const { VERSION } = await import('../app/js/version.js');
    assert.equal(VERSION, pkg.version);
});

test('the manifest names the app and uses relative URLs', () => {
    const manifest = JSON.parse(read('app/manifest.webmanifest'));
    assert.equal(manifest.name, 'Gorilla To Go');
    assert.equal(manifest.short_name, 'GTG');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.background_color, '#f8f6f2');
    for (const icon of manifest.icons) {
        assert.ok(fs.existsSync(path.join(APP, icon.src)), `missing icon ${icon.src}`);
    }
    assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('index.html has a strict Content Security Policy', () => {
    const html = read('app/index.html');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, 'no CSP meta tag');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self';/);
    assert.match(csp, /style-src 'self';/);
    assert.match(csp, /connect-src https:\/\/api\.github\.com;/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe/);
});

test('no inline scripts or style attributes in the app (the CSP blocks them)', () => {
    for (const file of appFiles().filter(f => /\.(html|js)$/.test(f))) {
        const text = fs.readFileSync(path.join(APP, file), 'utf8');
        assert.doesNotMatch(text, /\sstyle="/, `${file} has a style attribute`);
        assert.doesNotMatch(text, /setAttribute\(\s*['"]style/, `${file} sets a style attribute`);
        if (file.endsWith('.html')) {
            assert.doesNotMatch(text, /<script(?![^>]*\ssrc=)[^>]*>/, `${file} has an inline script`);
        }
    }
});

test('the app loads no third-party resources', () => {
    for (const file of appFiles().filter(f => /\.(html|js|css|webmanifest)$/.test(f))) {
        // Links that the user taps (href="…", and the external('…') links of the install page) load
        // nothing. Everything else (src, url(), fetch) must stay on GitHub or in the app.
        const text = fs.readFileSync(path.join(APP, file), 'utf8')
            .replace(/href="https:\/\/[^"]+"/g, '')
            .replace(/external\('https:\/\/[^']+'/g, '');
        const urls = text.match(/https?:\/\/[^\s'"`)<]+/g) || [];
        for (const url of urls) {
            assert.ok(
                url.startsWith('https://api.github.com') || url.startsWith('https://github.com') || url.startsWith('http://www.w3.org/') ||
                url === 'https://gorillatogo.app',
                `${file} references ${url}`
            );
        }
    }
});
