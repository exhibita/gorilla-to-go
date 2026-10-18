// Service worker: keeps a copy of the app on the device, so the app opens offline.
// GitHub API requests always go to the network and are never cached.
// When you add, rename or remove a file in app/, update ASSETS (a test checks this).
// When you release a new version, VERSION changes with app/js/version.js (a test checks this).
const VERSION = '0.2.0';
const CACHE = `gtg-${VERSION}`;
const NETWORK_WAIT_MS = 3000;

const ASSETS = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/app.css',
    'fonts/OFL-Outfit.txt',
    'fonts/OFL-PlayfairDisplay.txt',
    'fonts/outfit-latin-400-normal.woff2',
    'fonts/outfit-latin-500-normal.woff2',
    'fonts/outfit-latin-600-normal.woff2',
    'fonts/outfit-latin-700-normal.woff2',
    'fonts/playfair-display-latin-700-normal.woff2',
    'img/apple-touch-icon.png',
    'img/icon-192.png',
    'img/icon-512.png',
    'img/icon-maskable-512.png',
    'img/logo.png',
    'js/app.js',
    'js/auth.js',
    'js/db.js',
    'js/dom.js',
    'js/edits.js',
    'js/editor-logic.js',
    'js/frontmatter-write.js',
    'js/frontmatter.js',
    'js/github.js',
    'js/pages-logic.js',
    'js/pages.js',
    'js/router.js',
    'js/screens/add-site.js',
    'js/screens/help.js',
    'js/screens/page.js',
    'js/screens/site.js',
    'js/screens/welcome.js',
    'js/sites-logic.js',
    'js/sites.js',
    'js/theme-boot.js',
    'js/theme-logic.js',
    'js/theme.js',
    'js/version.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ASSETS.map(asset => new Request(asset, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key.startsWith('gtg-') && key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only this app's own files. GitHub API calls and all other requests go to the network as usual.
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // Network first, so the app is always up to date when it is online. Each good response also
    // refreshes the cache. Offline, or with no answer in NETWORK_WAIT_MS (a weak signal), the cached
    // copy is used. Screens (navigations) all use index.html, because the app uses hash routes.
    const cacheKey = request.mode === 'navigate' ? 'index.html' : request;
    const network = fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(cacheKey, copy)));
        }
        return response;
    });
    const cached = () => caches.match(cacheKey, { ignoreSearch: true });

    event.respondWith(new Promise(resolve => {
        let answered = false;
        const answer = response => {
            if (!answered) {
                answered = true;
                resolve(response);
            }
        };
        const timer = setTimeout(() => cached().then(copy => copy && answer(copy)), NETWORK_WAIT_MS);
        network
            .then(response => {
                clearTimeout(timer);
                answer(response);
            })
            .catch(() => {
                clearTimeout(timer);
                cached().then(copy => answer(copy || Response.error()));
            });
    }));
});
