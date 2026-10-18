// GitHub API calls for Gorilla To Go. No DOM and no storage here: fetch and the token are
// parameters, so the module runs in tests with a fake fetch.
import { authorizationHeader } from './auth.js';

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

// Read "owner/repo" or a GitHub URL. Return { owner, repo }, or null if the text is not a repository.
export function parseRepoInput(text) {
    let value = String(text ?? '').trim().replace(/^https?:\/\//i, '');
    if (/^(www\.)?github\.com\//i.test(value)) {
        value = value.replace(/^(www\.)?github\.com\//i, '');
    } else if (/^[^/]*\./.test(value)) {
        return null; // Another host, for example gitlab.com/... (GitHub owner names have no dots.)
    }
    const [owner, rawRepo, ...rest] = value.split('/');
    const repo = (rawRepo ?? '').replace(/\.git$/i, '');
    if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo) || /\s/.test(rest.join('/'))) return null;
    return { owner, repo };
}

// One GitHub API request. Returns the Response. Throws a NetworkError when there is no connection.
async function request(fetch, token, path, { method = 'GET', body } = {}) {
    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: authorizationHeader(token)
    };
    if (body) headers['Content-Type'] = 'application/json';
    try {
        return await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch {
        throw new NetworkError();
    }
}

class NetworkError extends Error {}

const repoPath = (owner, repo) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

// Decode a base64 file from the contents API (GitHub adds line breaks) as UTF-8 text.
function decodeBase64(content) {
    const binary = atob(String(content).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}

// Read vanillaGorilla.templateVersion from package.json on the branch.
// Returns { ok: true, version } or { ok: false, label } with the failure text.
// A package.json without the field is template version 1.
export async function getTemplateVersion({ owner, repo, branch, token, fetch = globalThis.fetch }) {
    let response;
    try {
        response = await request(fetch, token, `${repoPath(owner, repo)}/contents/package.json?ref=${encodeURIComponent(branch)}`);
    } catch {
        return { ok: false, label: 'No connection to GitHub' };
    }
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

// Run the Add a site checks in order. The first failure stops the run.
// onUpdate(results) is called after each change. Returns { ok, templateVersion, results }.
// Each result: { id, label, status: 'waiting'|'running'|'pass'|'fail', help? }.
export async function checkSite({ owner, repo, branch, token, fetch = globalThis.fetch, onUpdate = () => {} }) {
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
        const repoResponse = await request(fetch, token, base);
        if (repoResponse.status === 401) return fail('token', 'Token not accepted');
        if (repoResponse.status !== 200 && repoResponse.status !== 404) return fail('token', unexpected(repoResponse));
        set('token', 'pass');

        set('repo', 'running');
        if (repoResponse.status === 404) return fail('repo', 'Repository not found');
        // Write access: a fine-grained token's grants cannot be read from the API, so try to create a
        // branch that points to an all-zero SHA. With write access GitHub refuses the SHA (422) and
        // creates nothing. Without write access GitHub refuses the request (403 or 404).
        const writeResponse = await request(fetch, token, `${base}/git/refs`, {
            method: 'POST',
            body: { ref: 'refs/heads/gtg-write-check', sha: '0'.repeat(40) }
        });
        if (writeResponse.status === 403 || writeResponse.status === 404) return fail('repo', 'No write access');
        if (writeResponse.status !== 422) return fail('repo', unexpected(writeResponse));
        set('repo', 'pass');

        // 3. Branch.
        set('branch', 'running');
        const branchResponse = await request(fetch, token, `${base}/branches/${encodeURIComponent(branch)}`);
        if (branchResponse.status === 404) return fail('branch', `Branch ${branch} not found`);
        if (!branchResponse.ok) return fail('branch', unexpected(branchResponse));
        set('branch', 'pass', { label: `Branch ${branch} found` });

        // 4. Template version.
        set('template', 'running');
        const template = await getTemplateVersion({ owner, repo, branch, token, fetch });
        if (!template.ok) return fail('template', template.label);
        templateVersion = template.version;
        const templateLabel = `Template version ${templateVersion} (required: ${REQUIRED_TEMPLATE_VERSION})`;
        if (templateVersion < REQUIRED_TEMPLATE_VERSION) return fail('template', templateLabel, { help: 'upgrade' });
        set('template', 'pass', { label: templateLabel });

        // 5. Actions: needed later for the publish status.
        set('actions', 'running');
        const actionsResponse = await request(fetch, token, `${base}/actions/runs?per_page=1`);
        if (actionsResponse.status === 403 || actionsResponse.status === 404) return fail('actions', 'No Actions access');
        if (!actionsResponse.ok) return fail('actions', unexpected(actionsResponse));
        set('actions', 'pass');

        return { ok: true, templateVersion, results };
    } catch (err) {
        if (!(err instanceof NetworkError)) throw err;
        const running = results.find(r => r.status === 'running') ?? results[0];
        return fail(running.id, 'No connection to GitHub');
    }
}
