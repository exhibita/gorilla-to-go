// Reads the photos that the service worker kept when the user shared them to the app.
// The service worker writes them to the 'gtg-share' cache under share/<shareId>/<index>.
// shareId starts with the time of the share (Date.now()), then a dash and a random part.
const SHARE_CACHE = 'gtg-share';
const ONE_DAY = 24 * 60 * 60 * 1000;
const KEY = /\/share\/([^/]+)\/(\d+)$/;

// The cache entries of every share: [{ shareId, index, request }].
async function entries(cache) {
    const found = [];
    for (const request of await cache.keys()) {
        const match = new URL(request.url).pathname.match(KEY);
        if (match) found.push({ shareId: decodeURIComponent(match[1]), index: Number(match[2]), request });
    }
    return found;
}

export async function readShare(shareId, cachesApi = caches) {
    const cache = await cachesApi.open(SHARE_CACHE);
    const own = (await entries(cache)).filter(e => e.shareId === shareId).sort((a, b) => a.index - b.index);
    const files = [];
    for (const { request } of own) {
        const response = await cache.match(request);
        if (!response) continue;
        const name = decodeURIComponent(response.headers.get('X-File-Name') || 'photo');
        files.push(new File([await response.blob()], name, { type: response.headers.get('Content-Type') || '' }));
    }
    return files;
}

async function deleteWhere(cachesApi, test) {
    const cache = await cachesApi.open(SHARE_CACHE);
    for (const e of await entries(cache)) {
        if (test(e.shareId)) await cache.delete(e.request);
    }
}

export function deleteShare(shareId, cachesApi = caches) {
    return deleteWhere(cachesApi, id => id === shareId);
}

// Deletes the shares that are more than one day old, so a share that the user did not finish does not stay for ever.
export function pruneShares(now = Date.now(), cachesApi = caches) {
    return deleteWhere(cachesApi, id => {
        const time = Number(id.split('-')[0]);
        return Number.isFinite(time) && now - time > ONE_DAY;
    });
}
