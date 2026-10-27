// GitHub API calls for Gorilla To Go. No DOM and no storage here: fetch and the token are
// parameters, so the module runs in tests with a fake fetch.
import { authorizationHeader } from './auth.js';
import { classifyPath } from './pages-logic.js';

const API = 'https://api.github.com';

// Sites must run this Vanilla Gorilla template version or newer (decisions 8, 9).
export const REQUIRED_TEMPLATE_VERSION = 2;

// The checks on the Add a site screen, in the order they run.
export const CHECKS = [
    { id: 'token', label: 'Token accepted' },
    { id: 'repo', label: 'Repository found, with write access' },
    { id: 'branch', label: 'Branch found' },
    { id: 'template', label: `Template version ${REQUIRED_TEMPLATE_VERSION} or newer` },
    { id: 'actions', label: 'Publish status can be read' }
];

const NAME = /^[A-Za-z0-9_.-]+$/;

// A request that gets no answer in this time fails with "No connection to GitHub".
const REQUEST_TIMEOUT_MS = 15000;

// Read "owner/repo", a GitHub URL or the SSH clone address. Return { owner, repo }, or null if the
// text is not a repository.
export function parseRepoInput(text) {
    let value = String(text ?? '').trim()
        .replace(/[?#].*$/, '') // A query or an anchor, for example ?tab=readme-ov-file
        .replace(/^git@github\.com:/i, '')
        .replace(/^https?:\/\//i, '');
    if (/^(www\.)?github\.com\//i.test(value)) {
        value = value.replace(/^(www\.)?github\.com\//i, '');
    } else if (/^[^/]*\./.test(value)) {
        return null; // Another host, for example gitlab.com/... (GitHub owner names have no dots.)
    }
    const [owner, rawRepo, ...rest] = value.split('/');
    const repo = (rawRepo ?? '').replace(/\.git$/i, '');
    if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo) || /^\.+$/.test(repo) || /\s/.test(rest.join('/'))) return null;
    return { owner, repo };
}

// True when the text is a branch name that git accepts (git check-ref-format --branch). The name
// goes into API paths, so ".." and "/" tricks must not pass.
export function isBranchName(text) {
    const name = String(text ?? '');
    if (!name || name.length > 255) return false;
    if (/[\x00-\x20\x7f~^:?*[\\]/.test(name)) return false; // Control characters, space, and git's reserved characters
    if (/\.\.|@\{|\/\/|\.lock(\/|$)/.test(name)) return false;
    if (name === '@' || name.startsWith('-') || name.startsWith('/') || name.endsWith('/') || name.endsWith('.')) return false;
    return name.split('/').every(part => part !== '' && !part.startsWith('.'));
}

class NetworkError extends Error {}
class CancelledError extends Error {}

// One GitHub API request. Returns the Response.
// Throws NetworkError when there is no connection or no answer in time, and CancelledError when the
// caller's signal stops the request.
async function request(fetch, token, path, { method = 'GET', body, signal, timeoutMs = REQUEST_TIMEOUT_MS, accept = 'application/vnd.github+json' } = {}) {
    if (signal?.aborted) throw new CancelledError();
    const headers = { Accept: accept };
    // No token: a public request (the changelog of the app). Else the token goes only through auth.js.
    if (token) headers.Authorization = authorizationHeader(token);
    if (body) headers['Content-Type'] = 'application/json';

    // One controller for the time limit and the caller's signal (AbortSignal.any is not on older iOS).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const stop = () => controller.abort();
    signal?.addEventListener('abort', stop);
    try {
        return await fetch(`${API}${path}`, {
            method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: controller.signal
        });
    } catch {
        throw signal?.aborted ? new CancelledError() : new NetworkError();
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', stop);
    }
}

const repoPath = (owner, repo) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

// Decode a base64 file from the contents API (GitHub adds line breaks) as UTF-8 text.
function decodeBase64(content) {
    const binary = atob(String(content).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}

// Read vanillaGorilla.templateVersion from package.json on the branch.
// Returns { ok: true, version } or { ok: false, label } with the failure text.
// A package.json without the field is template version 1.
export async function getTemplateVersion({ owner, repo, branch, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    let response;
    try {
        response = await request(fetch, token, `${repoPath(owner, repo)}/contents/package.json?ref=${encodeURIComponent(branch)}`, { signal, timeoutMs });
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        return { ok: false, label: 'No connection to GitHub' };
    }
    if (response.status === 401) return { ok: false, label: 'Token not accepted' };
    if (response.status === 404) return { ok: false, label: 'Not a Vanilla Gorilla site (no package.json)' };
    if (!response.ok) return { ok: false, label: `GitHub error ${response.status}` };
    try {
        const pkg = JSON.parse(decodeBase64((await response.json()).content));
        const version = Number(pkg?.vanillaGorilla?.templateVersion) || 1;
        return { ok: true, version };
    } catch {
        return { ok: false, label: 'Not a Vanilla Gorilla site (no package.json)' };
    }
}

// True when the account is an organization (public data). False when it is a person or cannot be read.
async function isOrganization(fetch, token, owner, net) {
    try {
        const response = await request(fetch, token, `/users/${encodeURIComponent(owner)}`, net);
        return response.ok && (await response.json()).type === 'Organization';
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        return false;
    }
}

// Run the Add a site checks in order. The first failure stops the run.
// onUpdate(results) is called after each change. Returns { ok, templateVersion, results }, with
// cancelled: true when the signal stopped the run.
// Each result: { id, label, status: 'waiting'|'running'|'pass'|'fail', help? }.
export async function checkSite({ owner, repo, branch, token, fetch = globalThis.fetch, onUpdate = () => {}, signal, timeoutMs }) {
    const net = { signal, timeoutMs };
    const results = CHECKS.map(check => ({ ...check, status: 'waiting' }));
    const byId = id => results.find(r => r.id === id);
    let templateVersion = null;

    const set = (id, status, extra = {}) => {
        Object.assign(byId(id), { status }, extra);
        onUpdate(results.map(r => ({ ...r })));
    };
    const fail = (id, label, extra = {}) => {
        set(id, 'fail', { label, ...extra });
        return { ok: false, templateVersion, results };
    };
    const unexpected = response => `GitHub error ${response.status}`;
    const base = repoPath(owner, repo);

    try {
        // 1. Token, and 2. repository: one request tells both. 401 = bad token, 404 = no such repository
        // (or the token has no access to it).
        set('token', 'running');
        const repoResponse = await request(fetch, token, base, net);
        if (repoResponse.status === 401) return fail('token', 'Token not accepted');
        if (repoResponse.status !== 200 && repoResponse.status !== 404) return fail('token', unexpected(repoResponse));
        set('token', 'pass');

        set('repo', 'running');
        if (repoResponse.status === 404) {
            // GitHub also says "not found" when the token cannot see a private repository. For a repository
            // of an organization, the usual cause is the token's resource owner or a token that the
            // organization did not approve: say so.
            const ownerIsOrganization = await isOrganization(fetch, token, owner, net);
            return fail('repo', ownerIsOrganization
                ? `Repository not found. ${owner} is an organization: the Resource owner of the token must be ${owner}, and the organization must allow and approve the token.`
                : 'Repository not found');
        }
        // Write access: a fine-grained token's grants cannot be read from the API, so try to create a
        // branch that points to an all-zero SHA. With write access GitHub refuses the SHA (422) and
        // creates nothing. Without write access GitHub refuses the request (403 or 404).
        const writeResponse = await request(fetch, token, `${base}/git/refs`, {
            method: 'POST',
            body: { ref: 'refs/heads/gtg-write-check', sha: '0'.repeat(40) },
            ...net
        });
        if (writeResponse.status === 403 || writeResponse.status === 404) return fail('repo', 'No write access');
        if (writeResponse.status !== 422) return fail('repo', unexpected(writeResponse));
        set('repo', 'pass');

        // 3. Branch.
        set('branch', 'running');
        const branchResponse = await request(fetch, token, `${base}/branches/${encodeURIComponent(branch)}`, net);
        if (branchResponse.status === 404) return fail('branch', `Branch ${branch} not found`);
        if (!branchResponse.ok) return fail('branch', unexpected(branchResponse));
        set('branch', 'pass', { label: `Branch ${branch} found` });

        // 4. Template version.
        set('template', 'running');
        const template = await getTemplateVersion({ owner, repo, branch, token, fetch, ...net });
        if (!template.ok) return fail('template', template.label);
        templateVersion = template.version;
        const templateLabel = `Template version ${templateVersion} (required: ${REQUIRED_TEMPLATE_VERSION})`;
        if (templateVersion < REQUIRED_TEMPLATE_VERSION) return fail('template', templateLabel, { help: 'upgrade' });
        set('template', 'pass', { label: templateLabel });

        // 5. Actions: needed later for the publish status.
        set('actions', 'running');
        const actionsResponse = await request(fetch, token, `${base}/actions/runs?per_page=1`, net);
        if (actionsResponse.status === 403 || actionsResponse.status === 404) return fail('actions', 'No Actions access');
        if (!actionsResponse.ok) return fail('actions', unexpected(actionsResponse));
        set('actions', 'pass');

        return { ok: true, templateVersion, results };
    } catch (err) {
        if (err instanceof CancelledError) return { ok: false, cancelled: true, templateVersion, results };
        if (!(err instanceof NetworkError)) throw err;
        const running = results.find(r => r.status === 'running') ?? results[0];
        return fail(running.id, 'No connection to GitHub');
    }
}

// An error for the page list: a message for the user, and offline: true when there is no connection.
export class GitHubError extends Error {
    constructor(message, { offline = false } = {}) {
        super(message);
        this.offline = offline;
    }
}

// GET a JSON resource. Throws GitHubError with the message to show.
async function getJson(fetch, token, path, net, notFoundMessage) {
    let response;
    try {
        response = await request(fetch, token, path, net);
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        throw new GitHubError('No connection to GitHub', { offline: true });
    }
    if (response.status === 401) throw new GitHubError('Token not accepted');
    if (response.status === 404) throw new GitHubError(notFoundMessage);
    if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
    return response.json();
}

// The Markdown pages of the branch: two requests (branch → tree SHA → whole tree).
// Returns { treeSha, truncated, files: [{ path, sha }] }. The tree SHA changes when any file changes.
// When knownTreeSha equals the current tree SHA, the tree is not read again: returns { treeSha, unchanged: true }.
export async function listMarkdownFiles({ owner, repo, branch, token, fetch = globalThis.fetch, signal, timeoutMs, knownTreeSha }) {
    const net = { signal, timeoutMs };
    const base = repoPath(owner, repo);
    const branchData = await getJson(fetch, token, `${base}/branches/${encodeURIComponent(branch)}`, net, `Branch ${branch} not found`);
    const treeSha = branchData.commit.commit.tree.sha;
    if (knownTreeSha && treeSha === knownTreeSha) return { treeSha, unchanged: true };
    const tree = await getJson(fetch, token, `${base}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`, net, 'Repository not found');
    const files = tree.tree
        .filter(entry => entry.type === 'blob' && classifyPath(entry.path))
        .map(({ path, sha }) => ({ path, sha }));
    return { treeSha, truncated: Boolean(tree.truncated), files };
}

// The text of one file, by its blob SHA.
export async function getBlobText({ owner, repo, sha, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const blob = await getJson(fetch, token, `${repoPath(owner, repo)}/git/blobs/${encodeURIComponent(sha)}`, { signal, timeoutMs }, 'File not found');
    return decodeBase64(blob.content);
}

export { CancelledError };

// Encode bytes as base64.
export function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

// Decode base64 to bytes.
export function base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// Encode text as UTF-8 base64 (the contents API needs base64).
function encodeBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
}

// Save a changed file as one commit on the branch. sha is the SHA of the file that the user opened:
// when the file changed on GitHub since then, GitHub refuses the save (409), so nothing is overwritten
// (mvp-plan section 9). Returns { sha } of the saved file, and { commitSha } when GitHub gives it
// (not after a time-out or a refusal that the app found to be an earlier save of the same text).
export async function saveFile({ owner, repo, branch, path, text, sha, message, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const filePath = String(path).split('/').map(encodeURIComponent).join('/');
    const contentsPath = `${repoPath(owner, repo)}/contents/${filePath}`;

    // The file as it is on GitHub now: { sha, text }, or null when it cannot be read.
    const readNow = async () => {
        try {
            const file = await getJson(fetch, token, `${contentsPath}?ref=${encodeURIComponent(branch)}`, { signal, timeoutMs }, 'File not found');
            return { sha: file.sha, text: decodeBase64(file.content) };
        } catch (err) {
            if (err instanceof CancelledError) throw err;
            return null;
        }
    };

    let response;
    try {
        response = await request(fetch, token, contentsPath, {
            method: 'PUT',
            body: { message, content: encodeBase64(text), sha, branch },
            signal,
            timeoutMs
        });
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        // No answer: the save can still have reached GitHub. When the file has the text now, it did.
        const now = await readNow();
        if (now?.text === text) return { sha: now.sha };
        throw new GitHubError('No connection to GitHub', { offline: true });
    }
    if (response.status === 409 || response.status === 422) {
        // An earlier save of this text (for example after a time-out) also gives 409: it is not a conflict.
        const now = await readNow();
        if (now?.text === text) return { sha: now.sha };
        // A new page (no SHA) and still no file: the refusal had another cause (for example the
        // branch moved during the save). It is not "the page exists".
        if (sha === undefined && now === null) throw new GitHubError('GitHub did not save the page. Try again');
        // 422 for a file that did not change on GitHub is another error (for example a bad branch).
        if (response.status === 422 && now?.sha === sha) throw new GitHubError('GitHub error 422');
        throw Object.assign(new GitHubError('This page changed on GitHub after you opened it.'), { conflict: true });
    }
    if (response.status === 401) throw new GitHubError('Token not accepted');
    if (response.status === 403 || response.status === 404) throw new GitHubError('No write access');
    if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
    const data = await response.json();
    return { sha: data.content.sha, commitSha: data.commit?.sha ?? null };
}

// True when a file or folder exists on the branch (to check the address of a new page).
export async function pathExists({ owner, repo, branch, path, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const filePath = String(path).split('/').map(encodeURIComponent).join('/');
    try {
        await getJson(fetch, token, `${repoPath(owner, repo)}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, { signal, timeoutMs }, 'not found');
        return true;
    } catch (err) {
        if (err instanceof GitHubError && err.message === 'not found') return false;
        throw err;
    }
}

// Delete a file in one commit on the branch (mvp-plan section 5 "Delete"). sha is the SHA of the file
// the user opened: when the file changed on GitHub since then, nothing is deleted (409).
// A file that is already gone counts as deleted. After no answer or a refusal, the app reads the
// file: when it is gone, the delete (or an earlier one) reached GitHub.
export async function deleteFile({ owner, repo, branch, path, sha, message, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const filePath = String(path).split('/').map(encodeURIComponent).join('/');
    const contentsPath = `${repoPath(owner, repo)}/contents/${filePath}`;

    // { gone: true }, { sha } of the file now, { offline: true }, or null when the app cannot tell.
    const fileNow = async () => {
        const net = { signal, timeoutMs };
        try {
            const file = await getJson(fetch, token, `${contentsPath}?ref=${encodeURIComponent(branch)}`, net, 'gone');
            return { sha: file.sha };
        } catch (err) {
            if (err instanceof CancelledError) throw err;
            if (err.offline) return { offline: true };
            if (!(err instanceof GitHubError && err.message === 'gone')) return null;
        }
        // "Not found" also comes when the token lost access or the branch is gone. The file is gone
        // only when the branch can still be read.
        try {
            await getJson(fetch, token, `${repoPath(owner, repo)}/branches/${encodeURIComponent(branch)}`, net, 'no branch');
            return { gone: true };
        } catch (err) {
            if (err instanceof CancelledError) throw err;
            if (err.offline) return { offline: true };
            if (err.message === 'no branch') return { noBranch: true };
            return null;
        }
    };

    let response;
    try {
        response = await request(fetch, token, contentsPath, { method: 'DELETE', body: { message, sha, branch }, signal, timeoutMs });
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        if ((await fileNow())?.gone) return { commitSha: null };
        throw new GitHubError('No connection to GitHub', { offline: true });
    }
    if (response.ok) return { commitSha: (await response.json().catch(() => ({}))).commit?.sha ?? null };
    if (response.status === 401) throw new GitHubError('Token not accepted');

    const now = await fileNow();
    if (now?.gone) return { commitSha: null };
    if (now?.offline) throw new GitHubError('No connection to GitHub', { offline: true });
    if (now?.noBranch) throw new GitHubError(`Branch ${branch} not found`);
    if ((response.status === 409 || response.status === 422) && now?.sha && now.sha !== sha) {
        throw Object.assign(new GitHubError('This page changed on GitHub after you opened it.'), { conflict: true });
    }
    if (response.status === 403 || response.status === 404) throw new GitHubError('No write access');
    throw new GitHubError(`GitHub error ${response.status}`);
}

const encodePath = path => String(path).split('/').map(encodeURIComponent).join('/');

// The SHA that git gives a file: SHA-1 of "blob <size>\0" and the bytes.
export async function gitBlobSha(bytes) {
    const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const all = new Uint8Array(header.length + bytes.length);
    all.set(header);
    all.set(bytes, header.length);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

const MAX_COMMIT_TRIES = 3;
// A photo is about 1 MB: give a slow phone connection more time than for other requests.
const BLOB_TIMEOUT_MS = 60000;

// Save a page and its images in one commit on the branch, so the site deploys once (mvp-plan
// section 7). page: { path, text, baseSha } (baseSha null for a new page). images: [{ path, base64 }].
// The Git Data API has no SHA check as the contents API has, so the app does it: the page on the
// branch must still be the page the user opened, and an image must not replace another file. The
// branch is moved only forward (force: false). When the branch moved meanwhile, the app checks again.
// onProgress({ done, total }) tells the image uploads. Returns { sha } of the page file and { commitSha }.
export async function commitFiles({ owner, repo, branch, page, images = [], message, token, fetch = globalThis.fetch, onProgress = () => {}, signal, timeoutMs }) {
    const base = repoPath(owner, repo);
    const net = { signal, timeoutMs };
    const readRef = async () => (await getJson(fetch, token, `${base}/git/ref/heads/${encodePath(branch)}`, net, `Branch ${branch} not found`)).object.sha;
    const pageSha = await gitBlobSha(new TextEncoder().encode(page.text));
    const files = await Promise.all(images.map(async image => ({ ...image, sha: await gitBlobSha(base64ToBytes(image.base64)) })));
    const uploaded = new Map(); // Local SHA → SHA from GitHub, for the images sent in this publish.

    // A POST or PATCH. Returns the JSON answer, or { refused: message } when GitHub refuses a ref update (422).
    const send = async (method, path, body, options = {}) => {
        let response;
        try {
            response = await request(fetch, token, path, { method, body, ...net, ...options });
        } catch (err) {
            if (err instanceof CancelledError) throw err;
            throw new GitHubError('No connection to GitHub', { offline: true });
        }
        if (response.status === 401) throw new GitHubError('Token not accepted');
        if (response.status === 422 && method === 'PATCH') return { refused: (await response.json().catch(() => ({}))).message ?? 'GitHub error 422' };
        if (response.status === 403 || response.status === 404) throw new GitHubError('No write access');
        if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
        return response.json();
    };

    // The file or folder at a commit: the contents API answer, or null when there is nothing.
    const contentsAt = async (path, commitSha) => {
        try {
            return await getJson(fetch, token, `${base}/contents/${encodePath(path)}?ref=${encodeURIComponent(commitSha)}`, net, 'not found');
        } catch (err) {
            if (err instanceof GitHubError && err.message === 'not found') return null;
            throw err;
        }
    };

    let timedOut = false;
    for (let attempt = 1; attempt <= MAX_COMMIT_TRIES; attempt++) {
        timedOut = false;
        const commitSha = await readRef();
        const commit = await getJson(fetch, token, `${base}/git/commits/${encodeURIComponent(commitSha)}`, net, 'Repository not found');

        // The files on the branch now.
        const pageNow = (await contentsAt(page.path, commitSha))?.sha ?? null;
        const onGitHub = new Map();
        for (const folder of new Set(files.map(file => file.path.slice(0, file.path.lastIndexOf('/'))))) {
            const entries = await contentsAt(folder, commitSha);
            if (Array.isArray(entries)) for (const entry of entries) onGitHub.set(entry.path, entry.sha);
        }
        const toSend = files.filter(file => onGitHub.get(file.path) !== file.sha);

        // An earlier publish (for example one that timed out) put everything there already.
        if (pageNow === pageSha && toSend.length === 0) return { sha: pageSha, commitSha };
        if (pageNow !== (page.baseSha ?? null) && pageNow !== pageSha) {
            throw Object.assign(new GitHubError('This page changed on GitHub after you opened it.'), { conflict: true });
        }
        // Letter case does not matter: Cat.jpg and cat.jpg are one file on Windows and macOS.
        const pathsOnGitHub = [...onGitHub.keys()].map(p => p.toLowerCase());
        const taken = toSend.find(file => pathsOnGitHub.includes(file.path.toLowerCase()));
        if (taken) {
            const name = taken.path.split('/').pop();
            throw Object.assign(new GitHubError(`An image with the name ${name} exists on GitHub`), { imageExists: taken.path });
        }

        const blobs = toSend.filter(file => !uploaded.has(file.sha));
        if (blobs.length) onProgress({ done: 0, total: blobs.length });
        for (const [i, file] of blobs.entries()) {
            const blob = await send('POST', `${base}/git/blobs`, { content: file.base64, encoding: 'base64' }, { timeoutMs: timeoutMs ?? BLOB_TIMEOUT_MS });
            uploaded.set(file.sha, blob.sha);
            onProgress({ done: i + 1, total: blobs.length });
        }

        const tree = await send('POST', `${base}/git/trees`, {
            base_tree: commit.tree.sha,
            tree: [
                { path: page.path, mode: '100644', type: 'blob', content: page.text },
                ...toSend.map(file => ({ path: file.path, mode: '100644', type: 'blob', sha: uploaded.get(file.sha) }))
            ]
        });
        const newCommit = await send('POST', `${base}/git/commits`, { message, tree: tree.sha, parents: [commitSha] });

        let updated;
        try {
            updated = await send('PATCH', `${base}/git/refs/heads/${encodePath(branch)}`, { sha: newCommit.sha, force: false });
        } catch (err) {
            if (!err.offline) throw err;
            // No answer: the update can still have reached GitHub. When the branch has the commit, it did.
            if (await readRef() === newCommit.sha) return { sha: pageSha, commitSha: newCommit.sha };
            timedOut = true;
            continue;
        }
        if (!updated.refused) return { sha: pageSha, commitSha: newCommit.sha };
        // 422: usually the branch moved after the app read it: read it again and check again. When the
        // branch did not move, GitHub refused for another reason (for example a branch rule).
        if (await readRef() === commitSha) throw new GitHubError(`GitHub refused the publish: ${updated.refused}`);
    }
    if (timedOut) throw new GitHubError('No connection to GitHub', { offline: true });
    throw new GitHubError('The site changed during the publish. Try again');
}

// The files in a folder on the branch: [{ name, path, sha }], or [] when there is no folder.
export async function listFolder({ owner, repo, branch, path, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    try {
        const entries = await getJson(fetch, token, `${repoPath(owner, repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, { signal, timeoutMs }, 'not found');
        return Array.isArray(entries) ? entries.filter(entry => entry.type === 'file').map(({ name, path, sha }) => ({ name, path, sha })) : [];
    } catch (err) {
        if (err instanceof GitHubError && err.message === 'not found') return [];
        throw err;
    }
}

// Send one request for the inbox calls. Throws GitHubError for no connection and for a refused token.
async function inboxRequest(fetch, token, path, options) {
    try {
        const response = await request(fetch, token, path, options);
        if (response.status === 401) throw new GitHubError('Token not accepted');
        return response;
    } catch (err) {
        if (err instanceof CancelledError || err instanceof GitHubError) throw err;
        throw new GitHubError('No connection to GitHub', { offline: true });
    }
}

// The SHA of the commit at the end of a branch, or null when there is no such branch.
export async function getRefSha({ owner, repo, branch, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const response = await inboxRequest(fetch, token, `${repoPath(owner, repo)}/git/ref/heads/${encodePath(branch)}`, { signal, timeoutMs });
    if (response.status === 404) return null;
    if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
    return (await response.json()).object.sha;
}

// Delete a branch. A branch that is already gone (422 or 404) counts as deleted.
export async function deleteBranch({ owner, repo, branch, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const response = await inboxRequest(fetch, token, `${repoPath(owner, repo)}/git/refs/heads/${encodePath(branch)}`, { method: 'DELETE', signal, timeoutMs });
    if (response.ok || response.status === 422 || response.status === 404) return;
    if (response.status === 403) throw new GitHubError('No write access');
    throw new GitHubError(`GitHub error ${response.status}`);
}

// The bytes of one file, by its blob SHA.
export async function getBlobBytes({ owner, repo, sha, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const response = await inboxRequest(fetch, token, `${repoPath(owner, repo)}/git/blobs/${encodeURIComponent(sha)}`, {
        signal, timeoutMs: timeoutMs ?? BLOB_TIMEOUT_MS, accept: 'application/vnd.github.raw+json'
    });
    if (response.status === 404) throw new GitHubError('File not found');
    if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
}

// The GitHub Actions runs of the branch (newest first), or of one commit (headSha), for the publish
// status. Returns [{ sha, event, status, conclusion, url, createdAt, updatedAt }]. A token without the
// Actions (read) permission gives an error with noAccess: true.
export async function listBuildRuns({ owner, repo, branch, headSha, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const query = `branch=${encodeURIComponent(branch)}&per_page=20${headSha ? `&head_sha=${encodeURIComponent(headSha)}` : ''}`;
    let response;
    try {
        response = await request(fetch, token, `${repoPath(owner, repo)}/actions/runs?${query}`, { signal, timeoutMs });
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        throw new GitHubError('No connection to GitHub', { offline: true });
    }
    if (response.status === 401) throw new GitHubError('Token not accepted');
    // 403 is also the answer when the rate limit is used up: that is not "no access".
    const rateLimited = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0';
    if ((response.status === 403 && !rateLimited) || response.status === 404) {
        throw Object.assign(new GitHubError('No Actions access'), { noAccess: true });
    }
    if (!response.ok) throw new GitHubError(`GitHub error ${response.status}`);
    const data = await response.json();
    return (data.workflow_runs ?? []).map(run => ({
        sha: run.head_sha,
        event: run.event,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        createdAt: run.created_at,
        updatedAt: run.updated_at
    }));
}

// The full changelog of the app (CHANGELOG.md on main), for the "What is new" page when the app is
// online. The repository is public, so no token goes with this request. Returns the text, or null.
export async function getChangelog({ fetch = globalThis.fetch, signal, timeoutMs } = {}) {
    try {
        const response = await request(fetch, null, '/repos/exhibita/gorilla-to-go/contents/CHANGELOG.md?ref=main', {
            signal, timeoutMs, accept: 'application/vnd.github.raw+json'
        });
        return response.ok ? await response.text() : null;
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        return null;
    }
}

// The stylesheet of the site (src/css/style.css), for the look of the Preview (site-look.js).
// Returns the text, or null when the file cannot be read (for example offline, or no such file).
export async function getSiteCss({ owner, repo, branch, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    try {
        const response = await request(fetch, token, `${repoPath(owner, repo)}/contents/src/css/style.css?ref=${encodeURIComponent(branch)}`, {
            signal, timeoutMs, accept: 'application/vnd.github.raw+json'
        });
        return response.ok ? await response.text() : null;
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        return null;
    }
}

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' };

// An image of the site as a data: URL, for the Preview (the CSP allows data: images, not GitHub
// addresses). Returns null when the image cannot be read.
export async function getImageDataUrl({ owner, repo, branch, path, token, fetch = globalThis.fetch, signal, timeoutMs }) {
    const type = IMAGE_TYPES[String(path).split('.').pop().toLowerCase()];
    if (!type) return null;
    try {
        const response = await request(fetch, token, `${repoPath(owner, repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, {
            signal, timeoutMs, accept: 'application/vnd.github.raw+json'
        });
        if (!response.ok) return null;
        return `data:${type};base64,${bytesToBase64(new Uint8Array(await response.arrayBuffer()))}`;
    } catch (err) {
        if (err instanceof CancelledError) throw err;
        return null;
    }
}
