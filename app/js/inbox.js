// The photo inbox of the iPhone path (spec section 8). An Apple Shortcut uploads photos to the folder
// "gtg-inbox" on the branch "gtg-inbox" of the site repository. This module lists the waiting photos,
// discards one, and cleans up after a publish.
// - A published photo goes on a cleanup list on the device first. Then its file is deleted from the inbox.
//   When the delete does not finish, the next count of the site runs the list again. Nothing is lost.
// - The inbox branch is deleted only when the folder is empty on two reads.
import { listFolder, deleteFile, getRefSha, deleteBranch, getBlobBytes } from './github.js';
import * as db from './db.js';

export const INBOX_BRANCH = 'gtg-inbox';
export const INBOX_FOLDER = 'gtg-inbox';

const MAX_PARALLEL_DOWNLOADS = 4;
const REMOVE_MESSAGE = 'Remove a photo from the gallery inbox';

// The IndexedDB store "inbox". Record: { siteId, cleanup: [{ path, sha }] }.
export const inboxStore = {
    get: siteId => db.get('inbox', siteId),
    put: record => db.put('inbox', record)
};

// A store in memory, for tests.
export function memoryInboxStore() {
    const records = new Map();
    return {
        get: async siteId => records.get(siteId),
        put: async record => void records.set(record.siteId, record)
    };
}

const target = ({ site, token, fetch }) => ({ owner: site.owner, repo: site.repo, branch: INBOX_BRANCH, token, fetch });
const sameFile = (a, b) => a.path === b.path && a.sha === b.sha;

async function cleanupList(site, store) {
    return (await store.get(site.id))?.cleanup ?? [];
}

// The files in the inbox folder. A file on the cleanup list is published already: it is not waiting.
async function listInbox({ site, token, fetch = globalThis.fetch, store = inboxStore }) {
    const files = await listFolder({ ...target({ site, token, fetch }), path: INBOX_FOLDER });
    const published = await cleanupList(site, store);
    return files.filter(file => !published.some(entry => sameFile(entry, file)));
}

// The number of photos that wait, or null when the app cannot tell (for example, offline).
export async function countWaiting(opts) {
    try {
        await runCleanup(opts);
        return (await listInbox(opts)).length;
    } catch {
        return null;
    }
}

// The waiting photos: [{ name, path, sha, bytes }]. No more than 4 downloads run at the same time.
export async function listWaiting(opts) {
    const { site, token, fetch = globalThis.fetch } = opts;
    const files = await listInbox(opts);
    const items = new Array(files.length);
    let next = 0;
    let failed = false;
    const worker = async () => {
        while (!failed && next < files.length) {
            const index = next++;
            try {
                const bytes = await getBlobBytes({ owner: site.owner, repo: site.repo, sha: files[index].sha, token, fetch });
                items[index] = { ...files[index], bytes };
            } catch (err) {
                failed = true;
                throw err;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_DOWNLOADS, files.length) }, worker));
    return items;
}

// Mark each photo that a kept local edit of the site already has (pending: true).
// edits: the result of listSiteEdits.
export function markPending(waiting, edits) {
    const pendingShas = new Set(edits.flatMap(edit => (edit.images ?? []).map(image => image.inbox?.sha)).filter(Boolean));
    return waiting.map(item => (pendingShas.has(item.sha) ? { ...item, pending: true } : item));
}

// Delete one waiting photo from the inbox. When it was the last photo, delete the inbox branch.
// A failed branch delete does not matter here: the photo is gone.
export async function discard({ item, ...opts }) {
    const { site, token, fetch = globalThis.fetch } = opts;
    await deleteFile({ ...target({ site, token, fetch }), path: item.path, sha: item.sha, message: REMOVE_MESSAGE });
    try {
        await deleteBranchIfEmpty(opts);
    } catch {
        // The next cleanup deletes the empty branch.
    }
}

// Put published inbox files on the cleanup list of the site.
export async function recordPublished({ site, origins, store = inboxStore }) {
    const cleanup = await cleanupList(site, store);
    const added = origins.filter(origin => !cleanup.some(entry => sameFile(entry, origin)));
    await store.put({ siteId: site.id, cleanup: [...cleanup, ...added.map(({ path, sha }) => ({ path, sha }))] });
}

// Take one file off the cleanup list. The list is read again, so a file that was added meanwhile stays.
async function forget(site, entry, store) {
    const cleanup = await cleanupList(site, store);
    await store.put({ siteId: site.id, cleanup: cleanup.filter(other => !sameFile(other, entry)) });
}

// Delete the files on the cleanup list. A failed delete leaves the file on the list. With an empty list,
// no request is sent. When at least one file was deleted, the empty inbox branch is deleted too.
export async function runCleanup(opts) {
    const { site, token, fetch = globalThis.fetch, store = inboxStore } = opts;
    let deleted = 0;
    for (const entry of await cleanupList(site, store)) {
        try {
            await deleteFile({ ...target({ site, token, fetch }), path: entry.path, sha: entry.sha, message: REMOVE_MESSAGE });
        } catch (err) {
            // No connection: the next files would fail too. Another error: when the branch is gone, the file is gone.
            if (err.offline) break;
            if (await getRefSha(target({ site, token, fetch })).catch(() => 'unknown') !== null) continue;
        }
        await forget(site, entry, store);
        deleted++;
    }
    if (deleted > 0) {
        try {
            await deleteBranchIfEmpty(opts);
        } catch {
            // The next cleanup deletes the empty branch.
        }
    }
}

// Delete the inbox branch when the folder is empty on two reads. A new upload between the reads stops it.
export async function deleteBranchIfEmpty({ site, token, fetch = globalThis.fetch }) {
    const args = target({ site, token, fetch });
    if ((await getRefSha(args)) === null) return { deleted: false };
    if ((await listFolder({ ...args, path: INBOX_FOLDER })).length > 0) return { deleted: false };
    if ((await listFolder({ ...args, path: INBOX_FOLDER })).length > 0) return { deleted: false };
    await deleteBranch(args);
    return { deleted: true };
}

// The inbox origins of images: [{ path, sha }].
export function inboxOrigins(images) {
    return images.filter(image => image.inbox).map(({ inbox }) => ({ path: inbox.path, sha: inbox.sha }));
}

// After a publish: delete the inbox files of the published images. An error is ignored: the cleanup
// list keeps the files, and the next open of the site tries again.
export async function cleanAfterPublish({ images, ...opts }) {
    const origins = inboxOrigins(images);
    if (origins.length === 0) return;
    try {
        await recordPublished({ ...opts, origins });
        await runCleanup(opts);
    } catch {
        // The next open of the site runs the cleanup list.
    }
}
