// Gorilla To Go: start the app.
import { route, startRouter, navigate } from './router.js';
import { watchSystemTheme } from './theme.js';
import { listSites, getLastSiteId } from './sites.js';
import { welcomeScreen } from './screens/welcome.js';
import { addSiteScreen } from './screens/add-site.js';
import { siteScreen } from './screens/site.js';
import { pageScreen } from './screens/page.js';
import { tokenHelpScreen, upgradeHelpScreen } from './screens/help.js';

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

watchSystemTheme();

route(/^#\/?$/, homeScreen);
route(/^#\/add$/, addSiteScreen);
route(/^#\/site\/([^/]+)$/, siteScreen);
route(/^#\/site\/([^/]+)\/page\/(.+)$/, pageScreen);
route(/^#\/help\/token$/, tokenHelpScreen);
route(/^#\/help\/upgrade$/, upgradeHelpScreen);

startRouter(document.getElementById('app'));

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
        // No offline support (for example over plain HTTP on a phone). The app still works online.
    });
}

// Ask the browser to keep the site list and tokens (iOS can delete local data, mvp-plan section 9).
navigator.storage?.persist?.().catch(() => {});
