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
        assert.ok(INSTALL_PAGE.includes(`>${title}</h`) || INSTALL_PAGE.includes(`>${title.replace(/'/g, "'")}</h`), `missing section: ${title}`);
    }
});
