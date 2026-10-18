// Theme rules (design.md): System, Light and Dark. The default is System.
// theme-boot.js repeats the key and colors, because it must run before the modules load.
export const THEMES = ['system', 'light', 'dark'];
export const THEME_KEY = 'gtg.theme';
export const THEME_COLORS = { light: '#f8f6f2', dark: '#1c1a18' };

export function normalizeTheme(value) {
    return THEMES.includes(value) ? value : 'system';
}

// The next setting when the user taps the theme button.
export function nextTheme(theme) {
    return THEMES[(THEMES.indexOf(normalizeTheme(theme)) + 1) % THEMES.length];
}

// "light" or "dark": what the screen shows.
export function resolveTheme(theme, prefersDark) {
    if (theme === 'light' || theme === 'dark') return theme;
    return prefersDark ? 'dark' : 'light';
}
