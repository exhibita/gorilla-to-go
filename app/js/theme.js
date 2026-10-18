// Theme toggle (design.md): an icon button in the header. Each tap goes to the next setting.
import { THEME_KEY, THEME_COLORS, nextTheme, normalizeTheme, resolveTheme } from './theme-logic.js';
import { icon } from './dom.js';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const ICONS = { system: 'system', light: 'sun', dark: 'moon' };

export function getTheme() {
    try {
        return normalizeTheme(localStorage.getItem(THEME_KEY));
    } catch {
        return 'system';
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolveTheme(theme, darkQuery.matches)]);
}

export function setTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        // Not saved: the theme applies until the app closes.
    }
    applyTheme(theme);
}

// Keep theme-color correct when the device changes between light and dark.
export function watchSystemTheme() {
    darkQuery.addEventListener('change', () => applyTheme(getTheme()));
}

// The button HTML. Put it in a screen, then call bindThemeToggles(screen).
export function themeToggleHtml() {
    const theme = getTheme();
    return `<button type="button" class="icon-btn" data-theme-toggle aria-label="Theme: ${LABELS[theme]}. Tap to change.">${icon(ICONS[theme])}</button>`;
}

export function bindThemeToggles(root) {
    for (const button of root.querySelectorAll('[data-theme-toggle]')) {
        button.addEventListener('click', () => {
            const theme = nextTheme(getTheme());
            setTheme(theme);
            button.setAttribute('aria-label', `Theme: ${LABELS[theme]}. Tap to change.`);
            button.innerHTML = icon(ICONS[theme]);
        });
    }
}
