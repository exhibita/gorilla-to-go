import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE_SITE_URL, parseSiteConfig, checkSiteValues, applySiteConfig, needsAddressWarning, hasSiteChanges } from '../app/js/site-config.js';

const FILE = '{\n  "_comment": "x",\n  "siteUrl": "https://exhibita.github.io/vanilla-gorilla",\n  "siteTitle": "Vanilla Gorilla",\n  "siteDescription": "d",\n  "distributionId": "E1",\n  "awsProfile": "p"\n}\n';
const VALUES = { siteUrl: 'https://ex.com', siteTitle: 'Ex', siteDescription: 'About ex' };

test('applySiteConfig changes only the three keys and keeps the order of all keys', () => {
    const out = applySiteConfig(FILE, VALUES);
    assert.deepEqual(Object.keys(JSON.parse(out)), ['_comment', 'siteUrl', 'siteTitle', 'siteDescription', 'distributionId', 'awsProfile']);
    assert.equal(JSON.parse(out).distributionId, 'E1');
    assert.equal(JSON.parse(out).siteUrl, 'https://ex.com');
});

test('applySiteConfig keeps 4-space indentation and a missing final newline', () => {
    const four = JSON.stringify({ a: 1, siteUrl: 'x' }, null, 4);
    const out = applySiteConfig(four, VALUES);
    assert.match(out, /^\{\n {4}"a": 1,/);
    assert.ok(!out.endsWith('\n'));
    assert.ok(applySiteConfig(FILE, VALUES).endsWith('}\n'));
});

test('a file without the three keys gets them after its keys, and no _comment', () => {
    const out = JSON.parse(applySiteConfig('{"distributionId":"E1","awsProfile":"p"}', VALUES));
    assert.deepEqual(Object.keys(out), ['distributionId', 'awsProfile', 'siteUrl', 'siteTitle', 'siteDescription']);
});

test('no file gives a new file with the warning _comment first, 2 spaces and a final newline', () => {
    const out = applySiteConfig(null, VALUES);
    assert.deepEqual(Object.keys(JSON.parse(out)), ['_comment', 'siteUrl', 'siteTitle', 'siteDescription']);
    assert.match(JSON.parse(out)._comment, /^WARNING: Do NOT put secrets/);
    assert.match(out, /^\{\n {2}"_comment"/);
    assert.ok(out.endsWith('}\n'));
});

test('parseSiteConfig refuses text that is not a JSON object', () => {
    for (const bad of ['{ "a": ', '[]', '"x"', 'null']) assert.equal(parseSiteConfig(bad).ok, false);
    assert.deepEqual(parseSiteConfig(null), { ok: true, config: {} });
    assert.deepEqual(parseSiteConfig('{"a":1}'), { ok: true, config: { a: 1 } });
});

test('checkSiteValues trims, removes trailing slashes and requires an http(s) address and a title', () => {
    assert.deepEqual(checkSiteValues({ siteUrl: ' https://ex.com// ', siteTitle: ' Ex ', siteDescription: '' }),
        { values: { siteUrl: 'https://ex.com', siteTitle: 'Ex', siteDescription: '' }, errors: {} });
    assert.ok(checkSiteValues({ ...VALUES, siteUrl: 'ex.com' }).errors.siteUrl);
    assert.ok(checkSiteValues({ ...VALUES, siteUrl: 'ftp://ex.com' }).errors.siteUrl);
    assert.ok(checkSiteValues({ ...VALUES, siteTitle: '  ' }).errors.siteTitle);
    assert.equal(checkSiteValues({ ...VALUES, siteDescription: '' }).errors.siteDescription, undefined);
});

test('needsAddressWarning: missing or template address, but never for the template repository', () => {
    const site = { owner: 'me', repo: 'blog' };
    assert.equal(needsAddressWarning({}, site), true);
    assert.equal(needsAddressWarning({ siteUrl: TEMPLATE_SITE_URL }, site), true);
    assert.equal(needsAddressWarning({ siteUrl: `${TEMPLATE_SITE_URL}/` }, site), true);
    assert.equal(needsAddressWarning({ siteUrl: 'https://ex.com' }, site), false);
    assert.equal(needsAddressWarning({}, { owner: 'Exhibita', repo: 'Vanilla-Gorilla' }), false);
});

test('hasSiteChanges is false when Save would commit the same text, so no commit and no build start', () => {
    const same = { siteUrl: 'https://exhibita.github.io/vanilla-gorilla', siteTitle: 'Vanilla Gorilla', siteDescription: 'd' };
    assert.equal(hasSiteChanges(FILE, same), false);
    assert.equal(hasSiteChanges(FILE, VALUES), true);
    assert.equal(hasSiteChanges(null, VALUES), true, 'no file: Save makes the file');
});
