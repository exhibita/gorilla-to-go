import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { siteLook, TEMPLATE_LOOK, LOOK_KEYS } from '../app/js/site-look.js';

// The template style.css, shortened: the tokens and the rules that the look reads.
const TEMPLATE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit&display=swap');
/* Color Tokens */
:root {
  --bg-primary: #f8f6f2;       /* Warm linen */
  --surface: #ffffff;
  --surface-border: #e3dcd0;
  --text-main: #2b2927;
  --text-muted: #66615c;
  --text-light: #ffffff;
  --color-primary: #596e57;
  --font-sans: 'Outfit', sans-serif;
  --font-serif: 'Playfair Display', serif;
  --radius-md: 12px;
}
body { font-family: var(--font-sans); background-color: var(--bg-primary); color: var(--text-main); }
a { color: var(--color-primary); }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-serif); color: var(--text-main); }
@media (max-width: 768px) { body { color: red; } a { color: blue; } }
.link-button { color: var(--text-light); background-color: var(--color-primary); border: 1px solid var(--color-primary); border-radius: var(--radius-md); }
`;

// As hartisan.hair: other token names, a grey --text-light, links that inherit the text colour, and
// white link buttons with a gold border.
const HARTISAN_CSS = `
:root {
  --bg-primary: #FAF8F5; --bg-white: #FFFFFF;
  --text-primary: #0F2240; --text-secondary: #3E526D; --text-light: #6C7E96;
  --accent-gold: #C5A059;
  --font-title: 'Playfair Display', Georgia, serif;
  --font-body: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --radius-md: 12px;
}
body { background-color: var(--bg-primary); color: var(--text-primary); font-family: var(--font-body); }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-title); font-weight: 500; }
a { color: inherit; }
.btn-primary { background-color: var(--accent-gold); color: var(--bg-primary); }
.link-button { color: var(--text-primary); background-color: var(--bg-white); border: 1px solid var(--accent-gold); }
`;

// As breezy.camp: the body uses the serif font and the headings the sans font; a see-through surface.
const BREEZY_CSS = `
:root { --bg-primary: #eae8dc; --surface: rgba(255, 255, 255, 0.4); --text-main: #222222; --color-primary: #2b6e9d;
  --text-light: #ffffff; --font-sans: -apple-system, "Segoe UI", sans-serif; --font-serif: "Libre Baskerville", Palatino, serif; }
body { font-family: var(--font-serif); background-color: var(--bg-primary); color: var(--text-main); }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-sans); color: var(--text-main); }
a, a:visited { color: var(--color-primary); }
.btn-primary { background-color: var(--color-primary); color: var(--text-light); }
`;

test('the template stylesheet gives the template look', () => {
    assert.deepEqual(siteLook(TEMPLATE_CSS), { ...TEMPLATE_LOOK });
});

test('every key of the look always has a value', () => {
    for (const css of [TEMPLATE_CSS, HARTISAN_CSS, BREEZY_CSS, '', 'not css at all {', ':root { }']) {
        const look = siteLook(css);
        for (const key of LOOK_KEYS) assert.ok(typeof look[key] === 'string' && look[key] !== '', `${key} for ${JSON.stringify(css.slice(0, 30))}`);
    }
});

test('the rules come before the token names: other names, inherited link colour, button colours', () => {
    const look = siteLook(HARTISAN_CSS);
    assert.equal(look.bg, '#FAF8F5');
    assert.equal(look.text, '#0F2240');
    assert.equal(look.heading, '#0F2240', 'a heading without a colour has the text colour');
    assert.equal(look.link, '#0F2240', 'color: inherit gives the text colour');
    assert.equal(look.muted, '#3E526D');
    assert.equal(look.button, '#FFFFFF');
    assert.equal(look.buttonText, '#0F2240', 'not the grey --text-light');
    assert.equal(look.buttonBorder, '#C5A059');
    assert.equal(look.fontBody, `'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`);
    assert.equal(look.fontHeading, `'Playfair Display', Georgia, serif`);
    assert.equal(look.surface, 'transparent', 'no --surface: the content is on the background');
});

test('the fonts follow the body and heading rules, also when a site swaps them', () => {
    const look = siteLook(BREEZY_CSS);
    assert.equal(look.fontBody, '"Libre Baskerville", Palatino, serif');
    assert.equal(look.fontHeading, '-apple-system, "Segoe UI", sans-serif');
    assert.equal(look.surface, 'rgba(255, 255, 255, 0.4)');
    assert.equal(look.button, '#2b6e9d', '.btn-primary when there is no .link-button');
    assert.equal(look.buttonText, '#ffffff');
});

test('rules inside @media do not count, and the first rule for a selector counts', () => {
    const look = siteLook(TEMPLATE_CSS);
    assert.equal(look.text, '#2b2927');
    assert.equal(look.link, '#596e57');
});

test('a site button colour without a text colour gets a text colour that contrasts', () => {
    assert.equal(siteLook(':root { --color-primary: #111114; }').buttonText, '#ffffff');
    assert.equal(siteLook(':root { --color-primary: #f2eada; }').buttonText, '#111111');
    assert.equal(siteLook('.link-button { background-color: #C5A059; }').buttonText, '#111111');
});

test('values that are not plain colours, lengths or font names are refused', () => {
    const look = siteLook(`:root { --bg-primary: url(https://example.com/x.png); --text-main: red; }
        body { color: expression(alert(1)); font-family: "a" } a { color: var(--missing) }
        .link-button { background-color: #12345; border-radius: 1px; }`);
    assert.equal(look.bg, TEMPLATE_LOOK.bg);
    assert.equal(look.text, 'red', 'the token, after the refused rule value');
    assert.equal(look.button, TEMPLATE_LOOK.button);
    assert.equal(look.radius, '1px');
    for (const bad of ['1px; background: red', '} body { color: red', 'url(x)', '@import', 'a\\62', `${'a'.repeat(201)}`]) {
        assert.equal(siteLook(`:root { --font-sans: ${bad}; }`).fontBody, TEMPLATE_LOOK.fontBody, bad);
    }
});

test('var() with a fallback, and a token that uses another token', () => {
    const look = siteLook(':root { --ink: #101010; --text-main: var(--ink); } body { background-color: var(--nothing, #fafafa); }');
    assert.equal(look.text, '#101010');
    assert.equal(look.bg, '#fafafa');
});

test('the stylesheets of the local sites give a complete look', () => {
    const sites = ['vanilla-gorilla', 'gtg-test-site', 'breezy.camp', 'exhibita-static-site', 'hartisan.hair'];
    for (const site of sites) {
        const file = path.join('..', site, 'src', 'css', 'style.css');
        if (!fs.existsSync(file)) continue;
        const look = siteLook(fs.readFileSync(file, 'utf8'));
        for (const key of LOOK_KEYS) assert.ok(look[key], `${site}: ${key}`);
        if (site === 'vanilla-gorilla' || site === 'gtg-test-site') assert.deepEqual(look, { ...TEMPLATE_LOOK }, site);
        if (site === 'exhibita-static-site') {
            assert.equal(look.text, '#2a2a2f', 'body uses --text-body');
            assert.equal(look.button, '#111114', 'the black link buttons');
            assert.equal(look.buttonText, '#fff');
        }
    }
});
