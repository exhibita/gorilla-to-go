import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, nextTheme, resolveTheme, normalizeTheme, THEME_COLORS } from '../app/js/theme-logic.js';

test('the theme button cycles System, Light, Dark, then System again', () => {
    assert.deepEqual(THEMES, ['system', 'light', 'dark']);
    assert.equal(nextTheme('system'), 'light');
    assert.equal(nextTheme('light'), 'dark');
    assert.equal(nextTheme('dark'), 'system');
});

test('an unknown saved value is treated as System', () => {
    assert.equal(normalizeTheme('purple'), 'system');
    assert.equal(normalizeTheme(null), 'system');
    assert.equal(normalizeTheme('dark'), 'dark');
});

test('System follows the device; Light and Dark do not', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
});

test('theme-color uses the background color of each theme (design.md)', () => {
    assert.deepEqual(THEME_COLORS, { light: '#f8f6f2', dark: '#1c1a18' });
});
