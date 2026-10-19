import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INSTALL_PAGE, INSTALL_SECTIONS } from '../app/js/screens/help-install.js';

const APP = path.resolve('app');
const DOC = fs.readFileSync(path.resolve('docs/install-app.md'), 'utf8');

test('every image on the install page exists in the app and has alt text and a size', () => {
    const images = [...INSTALL_PAGE.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
    assert.ok(images.length >= 9);
    for (const tag of images) {
        const src = tag.match(/src="\.\/([^"]+)"/)[1];
        assert.ok(fs.existsSync(path.join(APP, src)), `${src} does not exist`);
        assert.match(tag, /alt="[^"]+"/, `${src} has no alt text`);
        assert.match(tag, /width="\d+" height="\d+"/, `${src} has no size`);
    }
});

test('the SVG files of the app have no script, link or event attribute', () => {
    const svgs = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.svg')) svgs.push(full);
        }
    };
    walk(APP);
    assert.ok(svgs.length >= 6);
    for (const file of svgs) {
        const text = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(text, /<script|<foreignObject|\shref=|xlink:href|\son\w+=|<!ENTITY|@import|url\(/i, path.relative(APP, file));
    }
});

test('the jump buttons say the phone and the browser, as the section titles do', () => {
    assert.match(INSTALL_PAGE, /<span>iPhone<\/span> <span class="visually-hidden">with<\/span> <strong>Safari<\/strong>/);
});

test('every jump button has its section on the page', () => {
    const jumps = [...INSTALL_PAGE.matchAll(/data-jump="([^"]+)"/g)].map(match => match[1]);
    assert.ok(jumps.length >= INSTALL_SECTIONS.length);
    for (const id of jumps) assert.match(INSTALL_PAGE, new RegExp(`id="${id}"`), id);
});

test('the guide in docs and the app page use the same images', () => {
    const inDoc = [...DOC.matchAll(/\.\.\/app\/img\/install\/([\w.-]+\.(?:svg|png|jpg))/g)].map(match => match[1]).filter(name => !name.startsWith('photo-'));
    const inApp = [...INSTALL_PAGE.matchAll(/\/img\/install\/([\w.-]+)"/g)].map(match => match[1]);
    assert.deepEqual([...new Set(inDoc)].sort(), [...new Set(inApp)].sort());
});

test('the install page has the section titles of the guide', () => {
    for (const title of [...DOC.matchAll(/^#{2,3} (.+)$/gm)].map(match => match[1])) {
        if (title === 'Find your instructions') continue;
        assert.ok(INSTALL_PAGE.includes(`>${title}</h`), `missing section: ${title}`);
    }
});
