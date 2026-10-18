// Sign-in module. All token handling is in this file, so GitHub sign-in (OAuth) can replace
// personal access tokens later without changes elsewhere (CLAUDE.md, decision 5).
// Rules: never log a token, never put it in a URL, store it only on this device.
import * as db from './db.js';

// The value of the Authorization header for GitHub API requests.
export function authorizationHeader(token) {
    return `Bearer ${token}`;
}

// Store the token for a site on this device.
export async function saveToken(siteId, token) {
    await db.put('tokens', { siteId, token });
}

// The stored token for a site, or null.
export async function getToken(siteId) {
    return (await db.get('tokens', siteId))?.token ?? null;
}

// Delete the stored token for a site.
export async function deleteToken(siteId) {
    await db.remove('tokens', siteId);
}
