// Gorilla To Go: start the app.
import { route, startRouter, navigate } from './router.js';
import { watchSystemTheme } from './theme.js';
import { listSites, getLastSiteId } from './sites.js';
import { welcomeScreen } from './screens/welcome.js';
import { addSiteScreen } from './screens/add-site.js';
import { siteScreen } from './screens/site.js';
import { pageScreen } from './screens/page.js';
import { editorScreen } from './screens/editor.js';
import { newPageScreen } from './screens/new-page.js';
import { tokenHelpScreen, upgradeHelpScreen, installHelpScreen, changesHelpScreen } from './screens/help.js';

// "#/": open the last site, else the first site, else the Welcome screen (decision 13).
async function homeScreen(container) {
    const sites = await listSites();
    if (sites.length === 0) {
        welcomeScreen(container);
        return;
    }
    const lastId = getLastSiteId();
    const site = sites.find(s => s.id === lastId) ?? sites[0];
    navigate(`#/site/${encodeURIComponent(site.id)}`, { replace: true });
}

function start() {
    watchSystemTheme();

    route(/^#\/?$/, homeScreen);
    route(/^#\/add$/, addSiteScreen);
    route(/^#\/site\/([^/]+)$/, siteScreen);
    route(/^#\/site\/([^/]+)\/page\/(.+)$/, pageScreen);
    route(/^#\/site\/([^/]+)\/edit\/(.+)$/, editorScreen);
    route(/^#\/site\/([^/]+)\/new$/, newPageScreen);
    route(/^#\/help\/token$/, tokenHelpScreen);
    route(/^#\/help\/upgrade$/, upgradeHelpScreen);
    route(/^#\/help\/install$/, installHelpScreen);
    route(/^#\/help\/changes$/, changesHelpScreen);

    startRouter(document.getElementById('app'));

    // For boot-check.js: the app runs. A later start failure can recover again.
    window.__gtgStarted = true;
    try {
        sessionStorage.removeItem('gtg.recovered');
    } catch {
        // No storage.
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // No offline support (for example over plain HTTP on a phone). The app still works online.
        });
    }

    // Ask the browser to keep the site list and tokens (iOS can delete local data, mvp-plan section 9).
    navigator.storage?.persist?.().catch(() => {});
}

// In a frame (boot-check.js): show nothing, register nothing, open no storage.
if (!window.__gtgFramed) start();
