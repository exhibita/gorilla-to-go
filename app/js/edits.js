// Unsaved changes in the editor, kept on the device while the user types (mvp-plan sections 1 and 9),
// so leaving the editor or a closed app loses nothing. Store "edits", key "<siteId> <path>".
import * as db from './db.js';

const key = (siteId, path) => `${siteId} ${path}`;

// { key, siteId, path, baseSha, text, savedAt } or undefined.
export function getLocalEdit(siteId, path) {
    return db.get('edits', key(siteId, path));
}

// baseSha: the SHA of the file the user opened. A save with an old SHA is refused by GitHub.
export function saveLocalEdit({ siteId, path, baseSha, text }) {
    return db.put('edits', { key: key(siteId, path), siteId, path, baseSha, text, savedAt: Date.now() });
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
