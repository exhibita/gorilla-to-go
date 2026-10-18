// The sites in the app. Tokens are stored by auth.js, not here.
import * as db from './db.js';
import { saveToken, deleteToken } from './auth.js';
import { findDuplicate } from './sites-logic.js';
import { deviceStore } from './pages.js';

const LAST_SITE_KEY = 'gtg.lastSite';

export class DuplicateSiteError extends Error {
    constructor() {
        super('This site is already in the app.');
    }
}

// All sites, oldest first.
export async function listSites() {
    return (await db.getAll('sites')).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export function getSite(id) {
    return db.get('sites', id);
}

// Add a site and store its token. Throws DuplicateSiteError when the repository and branch are already in the app.
export async function addSite({ owner, repo, branch, name, templateVersion }, token) {
    if (findDuplicate(await listSites(), { owner, repo, branch })) throw new DuplicateSiteError();
    const site = { id: crypto.randomUUID(), owner, repo, branch, name, templateVersion, addedAt: new Date().toISOString() };
    await db.put('sites', site);
    try {
        await saveToken(site.id, token);
    } catch (err) {
        await db.remove('sites', site.id);
        throw err;
    }
    setLastSiteId(site.id);
    return site;
}

export function updateSite(site) {
    return db.put('sites', site);
}

// Remove a site and delete its token from this device. The repository on GitHub does not change.
export async function removeSite(id) {
    await deleteToken(id);
    await db.remove('sites', id);
    if (getLastSiteId() === id) setLastSiteId(null);
    // The saved page list and page texts of the site. A failure here does not stop the removal.
    try {
        await deviceStore.deletePageList(id);
        await deviceStore.pruneBlobs();
    } catch {
        // The next page list load prunes again.
    }
}

// The last site the user opened (localStorage can be unavailable, for example in a private window).
export function getLastSiteId() {
    try {
        return localStorage.getItem(LAST_SITE_KEY);
    } catch {
        return null;
    }
}

export function setLastSiteId(id) {
    try {
        if (id) localStorage.setItem(LAST_SITE_KEY, id);
        else localStorage.removeItem(LAST_SITE_KEY);
    } catch {
        // Not saved: the app opens the first site instead.
    }
}
