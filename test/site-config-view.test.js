// The Site details part of the site sheet. It makes DOM nodes, so it runs in jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { siteConfigHtml } = await import('../app/js/screens/site-config-view.js');

const parse = html => new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
const CONFIG = { siteUrl: 'https://ex.com', siteTitle: 'A <b>', siteDescription: 'About' };
const fieldsDisabled = doc => [...doc.querySelectorAll('input, textarea, #save-config')].every(el => el.disabled);

test('the form shows the three values as text', () => {
    const doc = parse(siteConfigHtml({ config: CONFIG, warning: false }));
    assert.equal(doc.querySelector('#site-url').value, 'https://ex.com');
    assert.equal(doc.querySelector('#site-title').value, 'A <b>');
    assert.equal(doc.querySelector('#site-description').value, 'About');
    assert.equal(doc.querySelector('b'), null, 'a value shows as text');
    assert.equal(doc.querySelector('#save-config').disabled, false);
});

test('the warning shows only when warning is true', () => {
    const warned = parse(siteConfigHtml({ config: {}, warning: true })).querySelector('[data-address-warning]');
    assert.ok(warned && !warned.hidden);
    assert.match(warned.textContent, /RSS feed/);
    assert.match(warned.textContent, /sitemap/);
    const none = parse(siteConfigHtml({ config: CONFIG, warning: false })).querySelector('[data-address-warning]');
    assert.ok(!none || none.hidden);
});

test('offline and error states disable the fields and Save', () => {
    const offline = parse(siteConfigHtml({ offline: true }));
    assert.match(offline.body.textContent, /Not read: no connection to GitHub/);
    assert.ok(fieldsDisabled(offline));
    const error = parse(siteConfigHtml({ error: 'config.json is not valid JSON. Correct it on GitHub first.' }));
    assert.match(error.body.textContent, /config\.json is not valid JSON\. Correct it on GitHub first\./);
    assert.ok(fieldsDisabled(error));
});

test('loading shows a spinner and disabled fields', () => {
    const doc = parse(siteConfigHtml({ loading: true }));
    assert.ok(doc.querySelector('.spinner'));
    assert.ok(fieldsDisabled(doc));
});
