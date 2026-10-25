// Service worker: keeps a copy of the app on the device, so the app opens offline.
// GitHub API requests always go to the network and are never cached.
// When you add, rename or remove a file in app/, update ASSETS (a test checks this).
// When you release a new version, VERSION changes with app/js/version.js (a test checks this).
const VERSION = '0.15.0';
const CACHE = `gtg-${VERSION}`;
// Photos shared to the app wait here. The name has no version, so an update does not delete them.
const SHARE_CACHE = 'gtg-share';

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
    'img/install/android-chrome-install.svg',
    'img/install/android-chrome-menu.svg',
    'img/install/gtg-icon.png',
    'img/install/gtg-welcome-dark.jpg',
    'img/install/gtg-welcome-light.jpg',
    'img/install/ios-add-to-home-screen.svg',
    'img/install/ios-other-browsers.svg',
    'img/install/ios-safari-share.svg',
    'img/install/samsung-internet-menu.svg',
    'img/logo.png',
    'js/app.js',
    'js/auth.js',
    'js/boot-check.js',
    'js/build-status.js',
    'js/changelog-recent.js',
    'js/changelog.js',
    'js/db.js',
    'js/dom.js',
    'js/edits.js',
    'js/editor-logic.js',
    'js/frontmatter-write.js',
    'js/frontmatter.js',
    'js/github.js',
    'js/image-resize.js',
    'js/images.js',
    'js/inbox.js',
    'js/incoming.js',
    'js/links.js',
    'js/new-page.js',
    'js/pages-logic.js',
    'js/pages.js',
    'js/router.js',
    'js/sanitize.js',
    'js/site-look.js',
    'js/screens/about.js',
    'js/screens/add-site.js',
    'js/screens/editor-links.js',
    'js/screens/editor.js',
    'js/screens/help-install.js',
    'js/screens/help.js',
    'js/screens/new-page.js',
    'js/screens/page.js',
    'js/screens/site.js',
    'js/screens/welcome.js',
    'js/share-store.js',
    'js/sites-logic.js',
    'js/sites.js',
    'js/theme-boot.js',
    'js/theme-logic.js',
    'js/theme.js',
    'js/version.js',
    'vendor/marked/LICENSE.md',
    'vendor/marked/marked.esm.js'
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
            .then(keys => Promise.all(keys.filter(key => key.startsWith('gtg-') && key !== CACHE && key !== SHARE_CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Keeps each shared image in SHARE_CACHE and opens the share screen.
// The key is share/<shareId>/<index>. The time in shareId lets the app delete old shares.
async function keepShare(request) {
    const shareId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cache = await caches.open(SHARE_CACHE);
    const files = (await request.formData()).getAll('photos');
    let index = 0;
    for (const file of files) {
        if (typeof file === 'string' || !file.type.startsWith('image/')) continue;
        await cache.put(`share/${shareId}/${index}`, new Response(file, {
            headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }
        }));
        index += 1;
    }
    return Response.redirect(new URL('./#/share/' + shareId, self.registration.scope).href, 303);
}

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // A share from another app (Android share sheet). The app must answer it: GitHub Pages cannot.
    if (request.method === 'POST' && url.origin === self.location.origin
        && url.href === new URL('./share-target', self.registration.scope).href) {
        event.respondWith(keepShare(request));
        return;
    }

    // Only this app's own files. GitHub API calls and all other requests go to the network as usual.
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // Network first, so the app is always up to date when it is online. Each good response also
    // refreshes the cache. The cached copy is used only when there is no connection: a time limit
    // would mix new files with cached files of an older version, and then the app cannot start.
    // Screens (navigations) all use index.html, because the app uses hash routes.
    const cacheKey = request.mode === 'navigate' ? 'index.html' : request;
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    event.waitUntil(caches.open(CACHE).then(cache => cache.put(cacheKey, copy)));
                }
                return response;
            })
            .catch(() => caches.match(cacheKey, { ignoreSearch: true }).then(cached => cached || Response.error()))
    );
});
