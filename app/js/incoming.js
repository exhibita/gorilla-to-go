// Hands shared photos from the share screen to the gallery editor.
// The entry stays in memory. It holds one entry at a time.

let entry = null;

export function setIncoming(next) {
    entry = next;
}

// Returns the entry once for the same site and path. Then it returns null.
export function takeIncoming(siteId, path) {
    if (!entry || entry.siteId !== siteId || entry.path !== path) return null;
    const taken = entry;
    entry = null;
    return taken;
}
