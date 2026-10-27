// Unsaved changes in the editor, kept on the device while the user types (mvp-plan sections 1 and 9),
// so leaving the editor or a closed app loses nothing. Store "edits", key "<siteId> <path>".
import * as db from './db.js';

const key = (siteId, path) => `${siteId} ${path}`;

// { key, siteId, path, baseSha, text, images, savedAt } or undefined.
export function getLocalEdit(siteId, path) {
    return db.get('edits', key(siteId, path));
}

// baseSha: the SHA of the file the user opened. A save with an old SHA is refused by GitHub.
// images: the photos that the text uses and that are not on GitHub yet: [{ path, base64, mimeType }].
export function saveLocalEdit({ siteId, path, baseSha, text, images = [] }) {
    return db.put('edits', { key: key(siteId, path), siteId, path, baseSha: baseSha ?? null, text, images, savedAt: Date.now() });
}

export function deleteLocalEdit(siteId, path) {
    return db.remove('edits', key(siteId, path));
}

// When a site is removed from the app.
export async function deleteSiteEdits(siteId) {
    for (const edit of await db.getAll('edits')) {
        if (edit.siteId === siteId) await db.remove('edits', edit.key);
    }
}

// New pages of a site that are kept on this device and not published yet (no base SHA).
export async function listNewPages(siteId) {
    return (await db.getAll('edits')).filter(edit => edit.siteId === siteId && !edit.baseSha);
}

// All kept edits of a site, for the inbox screen (markPending).
export async function listSiteEdits(siteId) {
    return (await db.getAll('edits')).filter(edit => edit.siteId === siteId);
}
