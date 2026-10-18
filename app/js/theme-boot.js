// Applies the saved theme before the first paint. A classic script (not a module), loaded in <head>.
// The key and colors must match theme-logic.js.
(function () {
    var theme = 'system';
    try {
        theme = localStorage.getItem('gtg.theme') || 'system';
    } catch (e) {
        // No storage: use System.
    }
    if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
    }
    var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#1c1a18' : '#f8f6f2');
})();
