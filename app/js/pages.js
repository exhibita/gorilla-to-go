// Load the page list of a site, with a cache on the device.
// - The list of each site is saved with the tree SHA. An unchanged tree needs no file requests.
// - The text of each file is saved by its blob SHA, so a changed site reads only the changed files.
// - Offline, the saved list is used.
import { listMarkdownFiles, getBlobText, CancelledError } from './github.js';
import { parseFrontmatter } from './frontmatter.js';
import { pageSummary, sortPages } from './pages-logic.js';
import * as db from './db.js';

const MAX_PARALLEL_REQUESTS = 6;

// Change this number when pageSummary changes, so saved summaries are made again from the saved text.
const SUMMARY_VERSION = 1;

// The IndexedDB store. Stores: "pageLists" (key siteId), "blobs" (key sha).
export const deviceStore = {
    getPageList: siteId => db.get('pageLists', siteId),
    putPageList: entry => db.put('pageLists', entry),
    deletePageList: siteId => db.remove('pageLists', siteId),
    getBlob: async sha => (await db.get('blobs', sha))?.text,
    putBlob: (sha, text) => db.put('blobs', { sha, text }),
    // Delete the lists of sites that are not in the app any more, then every text that no list uses.
    async pruneBlobs() {
        const siteIds = new Set(await db.getAllKeys('sites'));
        const lists = await db.getAll('pageLists');
        for (const list of lists.filter(list => !siteIds.has(list.siteId))) await db.remove('pageLists', list.siteId);
        const keep = new Set(lists.filter(list => siteIds.has(list.siteId)).flatMap(list => list.pages.map(page => page.sha)));
        for (const key of await db.getAllKeys('blobs')) {
            if (!keep.has(key)) await db.remove('blobs', key);
        }
    }
};

// A store in memory, for tests.
export function memoryStore() {
    const lists = new Map();
    const blobs = new Map();
    return {
        getPageList: async siteId => lists.get(siteId),
        putPageList: async entry => void lists.set(entry.siteId, entry),
        deletePageList: async siteId => void lists.delete(siteId),
        getBlob: async sha => blobs.get(sha),
        putBlob: async (sha, text) => void blobs.set(sha, text),
        async pruneBlobs() {
            const keep = new Set([...lists.values()].flatMap(list => list.pages.map(page => page.sha)));
            for (const sha of blobs.keys()) if (!keep.has(sha)) blobs.delete(sha);
        },
        blobCount: () => blobs.size
    };
}

// The text of one page: the saved text, else from GitHub (then saved).
export async function getPageText({ site, token, sha, fetch = globalThis.fetch, store = deviceStore, signal }) {
    const saved = await store.getBlob(sha);
    if (saved !== undefined) return saved;
    const text = await getBlobText({ owner: site.owner, repo: site.repo, sha, token, fetch, signal });
    await store.putBlob(sha, text);
    return text;
}

// Run task(item) for each item, with no more than `limit` tasks at the same time.
// After the first failure, or when the signal stops the work, no new task starts.
async function inParallel(items, limit, task, signal) {
    let next = 0;
    let failed = false;
    const worker = async () => {
        while (!failed && !signal?.aborted && next < items.length) {
            try {
                await task(items[next++]);
            } catch (err) {
                failed = true;
                throw err;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    if (signal?.aborted) throw new CancelledError();
}

// Load the pages of a site. Returns { pages, fetchedAt, offline, truncated }.
// onProgress({ done, total }) reports the file requests. Throws GitHubError when there is no saved list.
export async function loadPages({ site, token, fetch = globalThis.fetch, store = deviceStore, onProgress = () => {}, signal }) {
    const saved = await store.getPageList(site.id);
    const usable = saved?.summaryVersion === SUMMARY_VERSION ? saved : null;
    const fromSaved = () => ({ pages: sortPages(saved.pages), fetchedAt: saved.fetchedAt, offline: true, truncated: saved.truncated });

    try {
        const listing = await listMarkdownFiles({ owner: site.owner, repo: site.repo, branch: site.branch, token, fetch, signal, knownTreeSha: usable?.treeSha });

        let pages;
        let truncated = listing.truncated;
        if (listing.unchanged) {
            pages = usable.pages;
            truncated = usable.truncated;
        } else {
            const known = new Map((usable?.pages ?? []).map(page => [`${page.sha} ${page.path}`, page]));
            const missing = listing.files.filter(file => !known.has(`${file.sha} ${file.path}`));
            let done = 0;
            onProgress({ done, total: missing.length });
            await inParallel(missing, MAX_PARALLEL_REQUESTS, async file => {
                const text = await getPageText({ site, token, sha: file.sha, fetch, store, signal });
                known.set(`${file.sha} ${file.path}`, pageSummary(file.path, file.sha, parseFrontmatter(text)));
                if (!signal?.aborted) onProgress({ done: ++done, total: missing.length });
            }, signal);
            pages = listing.files.map(file => known.get(`${file.sha} ${file.path}`));
        }

        // A stopped load saves nothing (for example, the site was removed during the load).
        if (signal?.aborted) throw new CancelledError();
        const entry = { siteId: site.id, treeSha: listing.treeSha, summaryVersion: SUMMARY_VERSION, pages, fetchedAt: Date.now(), truncated };
        await store.putPageList(entry);
        await store.pruneBlobs();
        return { pages: sortPages(pages), fetchedAt: entry.fetchedAt, offline: false, truncated };
    } catch (err) {
        if (err.offline && saved) return fromSaved();
        throw err;
    }
}
