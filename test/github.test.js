import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoInput, isBranchName, checkSite, getTemplateVersion, REQUIRED_TEMPLATE_VERSION, listMarkdownFiles, getBlobText, saveFile, pathExists, deleteFile } from '../app/js/github.js';

const TOKEN = 'github_pat_TESTTOKEN123';
const API = 'https://api.github.com';
const REPO = '/repos/exhibita/gtg-test-site';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const packageJson = pkg => json(200, { content: Buffer.from(JSON.stringify(pkg, null, 2)).toString('base64').replace(/(.{60})/g, '$1\n'), encoding: 'base64' });

// The responses of a site that passes every check.
function goodRoutes() {
    return {
        [`GET ${REPO}`]: () => json(200, { full_name: 'exhibita/gtg-test-site', permissions: { push: true } }),
        [`POST ${REPO}/git/refs`]: () => json(422, { message: 'Object does not exist' }),
        [`GET ${REPO}/branches/main`]: () => json(200, { name: 'main' }),
        [`GET ${REPO}/contents/package.json?ref=main`]: () => packageJson({ name: 'site', vanillaGorilla: { templateVersion: 2 } }),
        [`GET ${REPO}/actions/runs?per_page=1`]: () => json(200, { total_count: 1, workflow_runs: [] })
    };
}

// A fake fetch that answers from a route table and records every request.
function fakeFetch(routes) {
    const calls = [];
    const fetch = async (url, init = {}) => {
        const method = init.method || 'GET';
        calls.push({ url, method, headers: init.headers || {} });
        const route = routes[`${method} ${url.replace(API, '')}`];
        if (!route) throw new Error(`unexpected request ${method} ${url}`);
        return route();
    };
    return { fetch, calls };
}

const run = (routes, overrides = {}) => {
    const { fetch, calls } = fakeFetch(routes);
    const updates = [];
    const result = checkSite({
        owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch,
        onUpdate: results => updates.push(results.map(r => r.status)),
        ...overrides
    });
    return result.then(r => ({ ...r, calls, updates }));
};

const statuses = result => result.results.map(r => `${r.id}:${r.status}`);

// ---------- parseRepoInput ----------

test('parseRepoInput accepts owner/repo', () => {
    assert.deepEqual(parseRepoInput('exhibita/gtg-test-site'), { owner: 'exhibita', repo: 'gtg-test-site' });
});

test('parseRepoInput accepts a GitHub URL, with .git, a trailing slash, www and spaces', () => {
    const expected = { owner: 'exhibita', repo: 'gtg-test-site' };
    assert.deepEqual(parseRepoInput('https://github.com/exhibita/gtg-test-site'), expected);
    assert.deepEqual(parseRepoInput('https://github.com/exhibita/gtg-test-site.git'), expected);
    assert.deepEqual(parseRepoInput('https://github.com/exhibita/gtg-test-site/'), expected);
    assert.deepEqual(parseRepoInput('  https://www.github.com/exhibita/gtg-test-site/tree/main  '), expected);
    assert.deepEqual(parseRepoInput('github.com/exhibita/gtg-test-site'), expected);
});

test('parseRepoInput refuses text that is not a repository', () => {
    for (const bad of ['', '   ', 'exhibita', 'exhibita/', '/gtg', 'a/b/c d', 'https://gitlab.com/a/b', 'own er/repo']) {
        assert.equal(parseRepoInput(bad), null, `accepted "${bad}"`);
    }
});

// ---------- isBranchName ----------

test('isBranchName accepts names that git accepts', () => {
    for (const good of ['main', 'gh-pages', 'feature/new-page', 'release-1.2', 'v2.0', 'a/b/c', 'ünïcode']) {
        assert.ok(isBranchName(good), `refused "${good}"`);
    }
});

test('isBranchName refuses names that git refuses, and path tricks', () => {
    const bad = ['', ' ', 'a b', '..', 'a/../b', '../../user', '/main', 'main/', 'a//b', '.hidden', 'a/.b', 'main.', 'x.lock', 'x.lock/y',
        '-main', '@', 'a@{b', 'a~b', 'a^b', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b', 'a\tb', 'a\nb', 'a\x7fb', 'm'.repeat(256)];
    for (const name of bad) assert.equal(isBranchName(name), false, `accepted ${JSON.stringify(name)}`);
    assert.equal(isBranchName(null), false);
});

// ---------- checkSite ----------

test('a good site passes every check and reports template version 2', async () => {
    const result = await run(goodRoutes());
    assert.equal(result.ok, true);
    assert.equal(result.templateVersion, 2);
    assert.deepEqual(statuses(result), ['token:pass', 'repo:pass', 'branch:pass', 'template:pass', 'actions:pass']);
    assert.equal(result.results.find(r => r.id === 'template').label, 'Template version 2 (required: 2)');
    assert.equal(result.results.find(r => r.id === 'branch').label, 'Branch main found');
});

test('every request sends the token in the Authorization header and never in the URL', async () => {
    const result = await run(goodRoutes());
    assert.equal(result.calls.length, 5);
    for (const call of result.calls) {
        assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`);
        assert.equal(call.headers.Accept, 'application/vnd.github+json');
        assert.ok(!call.url.includes(TOKEN));
    }
});

test('the write check sends a ref with an all-zero SHA, so nothing is created', async () => {
    const { fetch, calls } = fakeFetch(goodRoutes());
    const bodies = [];
    await checkSite({
        owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN,
        fetch: (url, init) => { if (init?.body) bodies.push(JSON.parse(init.body)); return fetch(url, init); }
    });
    assert.equal(calls.filter(c => c.method === 'POST').length, 1);
    assert.equal(bodies[0].sha, '0'.repeat(40));
    assert.match(bodies[0].ref, /^refs\/heads\//);
});

test('onUpdate reports each step, and the checks run in order', async () => {
    const result = await run(goodRoutes());
    assert.deepEqual(result.updates[0], ['running', 'waiting', 'waiting', 'waiting', 'waiting']);
    assert.deepEqual(result.updates.at(-1), ['pass', 'pass', 'pass', 'pass', 'pass']);
});

test('a bad token fails with "Token not accepted" and later checks do not run', async () => {
    const routes = { ...goodRoutes(), [`GET ${REPO}`]: () => json(401, { message: 'Bad credentials' }) };
    const result = await run(routes);
    assert.equal(result.ok, false);
    assert.deepEqual(statuses(result), ['token:fail', 'repo:waiting', 'branch:waiting', 'template:waiting', 'actions:waiting']);
    assert.equal(result.results[0].label, 'Token not accepted');
    assert.equal(result.calls.length, 1);
});

test('an unknown repository fails with "Repository not found"', async () => {
    const routes = { ...goodRoutes(), [`GET ${REPO}`]: () => json(404, { message: 'Not Found' }) };
    const result = await run(routes);
    assert.deepEqual(statuses(result).slice(0, 2), ['token:pass', 'repo:fail']);
    assert.equal(result.results[1].label, 'Repository not found');
});

test('"Repository not found" for an organization says what to check on the token', async () => {
    const routes = {
        ...goodRoutes(),
        [`GET ${REPO}`]: () => json(404, { message: 'Not Found' }),
        'GET /users/exhibita': () => json(200, { login: 'exhibita', type: 'Organization' })
    };
    const result = await run(routes);
    assert.deepEqual(statuses(result).slice(0, 2), ['token:pass', 'repo:fail']);
    assert.equal(
        result.results[1].label,
        'Repository not found. exhibita is an organization: the Resource owner of the token must be exhibita, and the organization must allow and approve the token.'
    );
});

test('"Repository not found" for a person, or when the owner cannot be read, stays short', async () => {
    const personal = {
        ...goodRoutes(),
        [`GET ${REPO}`]: () => json(404, {}),
        'GET /users/exhibita': () => json(200, { login: 'exhibita', type: 'User' })
    };
    assert.equal((await run(personal)).results[1].label, 'Repository not found');
    const unknownOwner = { ...goodRoutes(), [`GET ${REPO}`]: () => json(404, {}), 'GET /users/exhibita': () => json(404, {}) };
    assert.equal((await run(unknownOwner)).results[1].label, 'Repository not found');
});

test('a token without Contents write permission fails with "No write access"', async () => {
    for (const status of [403, 404]) {
        const routes = { ...goodRoutes(), [`POST ${REPO}/git/refs`]: () => json(status, { message: 'Resource not accessible by personal access token' }) };
        const result = await run(routes);
        assert.deepEqual(statuses(result).slice(0, 3), ['token:pass', 'repo:fail', 'branch:waiting']);
        assert.equal(result.results[1].label, 'No write access');
    }
});

test('a missing branch fails with "Branch <name> not found"', async () => {
    const routes = { ...goodRoutes() };
    delete routes[`GET ${REPO}/branches/main`];
    routes[`GET ${REPO}/branches/live`] = () => json(404, { message: 'Branch not found' });
    const result = await run(routes, { branch: 'live' });
    assert.deepEqual(statuses(result).slice(0, 3), ['token:pass', 'repo:pass', 'branch:fail']);
    assert.equal(result.results[2].label, 'Branch live not found');
});

test('an old template fails and names the version it found', async () => {
    const routes = { ...goodRoutes(), [`GET ${REPO}/contents/package.json?ref=main`]: () => packageJson({ name: 'old-site' }) };
    const result = await run(routes);
    assert.equal(result.ok, false);
    assert.equal(result.templateVersion, 1);
    const row = result.results.find(r => r.id === 'template');
    assert.equal(row.status, 'fail');
    assert.equal(row.label, `Template version 1 (required: ${REQUIRED_TEMPLATE_VERSION})`);
    assert.equal(row.help, 'upgrade');
});

test('a repository without package.json is not a Vanilla Gorilla site', async () => {
    for (const response of [() => json(404, { message: 'Not Found' }), () => json(200, { content: Buffer.from('not json').toString('base64') })]) {
        const routes = { ...goodRoutes(), [`GET ${REPO}/contents/package.json?ref=main`]: response };
        const result = await run(routes);
        const row = result.results.find(r => r.id === 'template');
        assert.equal(row.status, 'fail');
        assert.equal(row.label, 'Not a Vanilla Gorilla site (no package.json)');
    }
});

test('a token without Actions permission fails with "No Actions access"', async () => {
    const routes = { ...goodRoutes(), [`GET ${REPO}/actions/runs?per_page=1`]: () => json(403, { message: 'Resource not accessible by personal access token' }) };
    const result = await run(routes);
    assert.equal(result.ok, false);
    assert.equal(result.results.at(-1).label, 'No Actions access');
});

test('no network gives "No connection to GitHub"', async () => {
    const result = await checkSite({
        owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN,
        fetch: async () => { throw new TypeError('Failed to fetch'); }
    });
    assert.equal(result.ok, false);
    assert.equal(result.results[0].status, 'fail');
    assert.equal(result.results[0].label, 'No connection to GitHub');
});

test('another GitHub error names the status', async () => {
    const routes = { ...goodRoutes(), [`GET ${REPO}`]: () => json(500, { message: 'Server Error' }) };
    const result = await run(routes);
    assert.equal(result.results[0].label, 'GitHub error 500');
});

test('the branch name is encoded in the URL', async () => {
    const branchUrl = `${API}${REPO}/branches/feature%2Fx%20y`;
    const routes = goodRoutes();
    routes[`GET ${REPO}/branches/feature%2Fx%20y`] = () => json(200, {});
    routes[`GET ${REPO}/contents/package.json?ref=feature%2Fx%20y`] = routes[`GET ${REPO}/contents/package.json?ref=main`];
    const result = await run(routes, { branch: 'feature/x y' });
    assert.ok(result.calls.some(c => c.url === branchUrl));
    assert.equal(result.ok, true);
});

// ---------- getTemplateVersion ----------

test('getTemplateVersion reads the version from package.json on the branch', async () => {
    const { fetch } = fakeFetch(goodRoutes());
    assert.deepEqual(await getTemplateVersion({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch }), { ok: true, version: 2 });
});

test('getTemplateVersion decodes UTF-8 text in package.json', async () => {
    const routes = { [`GET ${REPO}/contents/package.json?ref=main`]: () => packageJson({ description: 'Café ✓ 🦍', vanillaGorilla: { templateVersion: 3 } }) };
    const { fetch } = fakeFetch(routes);
    assert.deepEqual(await getTemplateVersion({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch }), { ok: true, version: 3 });
});

test('getTemplateVersion reports a token that GitHub no longer accepts', async () => {
    const routes = { [`GET ${REPO}/contents/package.json?ref=main`]: () => json(401, { message: 'Bad credentials' }) };
    const { fetch } = fakeFetch(routes);
    assert.deepEqual(await getTemplateVersion({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch }), { ok: false, label: 'Token not accepted' });
});

test('parseRepoInput accepts URLs with a query or an anchor, and the SSH clone URL', () => {
    const expected = { owner: 'exhibita', repo: 'gtg-test-site' };
    assert.deepEqual(parseRepoInput('https://github.com/exhibita/gtg-test-site?tab=readme-ov-file'), expected);
    assert.deepEqual(parseRepoInput('https://github.com/exhibita/gtg-test-site#readme'), expected);
    assert.deepEqual(parseRepoInput('git@github.com:exhibita/gtg-test-site.git'), expected);
    assert.equal(parseRepoInput('exhibita/..'), null);
});

test('a request that hangs fails with "No connection to GitHub" after the time limit', { timeout: 3000 }, async () => {
    // Never answers. Only an abort signal can end the request.
    const hangingFetch = (url, init) => new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const started = Date.now();
    const result = await checkSite({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: hangingFetch, timeoutMs: 50 });
    assert.ok(Date.now() - started < 2000);
    assert.equal(result.ok, false);
    assert.equal(result.results[0].status, 'fail');
    assert.equal(result.results[0].label, 'No connection to GitHub');
});

test('a run stops when the caller cancels it, and makes no more requests', async () => {
    const controller = new AbortController();
    const { fetch, calls } = fakeFetch(goodRoutes());
    const cancellingFetch = async (url, init) => {
        const response = await fetch(url, init);
        controller.abort();
        return response;
    };
    const result = await checkSite({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: cancellingFetch, signal: controller.signal });
    assert.equal(result.ok, false);
    assert.equal(result.cancelled, true);
    assert.equal(calls.length, 1);
});

// ---------- listMarkdownFiles and getBlobText ----------

test('listMarkdownFiles reads the tree of the branch and returns the Markdown files under src/', async () => {
    const routes = {
        [`GET ${REPO}/branches/main`]: () => json(200, { commit: { commit: { tree: { sha: 'TREE1' } } } }),
        [`GET ${REPO}/git/trees/TREE1?recursive=1`]: () => json(200, {
            truncated: false,
            tree: [
                { path: 'src', type: 'tree', sha: 't0' },
                { path: 'src/blog/a/index.md', type: 'blob', sha: 's1' },
                { path: 'src/index.html', type: 'blob', sha: 's2' },
                { path: 'src/templates/x.md', type: 'blob', sha: 's3' },
                { path: 'README.md', type: 'blob', sha: 's4' },
                { path: 'src/privacy/index.md', type: 'blob', sha: 's5' }
            ]
        })
    };
    const { fetch } = fakeFetch(routes);
    const result = await listMarkdownFiles({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch });
    assert.deepEqual(result, {
        treeSha: 'TREE1',
        truncated: false,
        files: [{ path: 'src/blog/a/index.md', sha: 's1' }, { path: 'src/privacy/index.md', sha: 's5' }]
    });
});

test('listMarkdownFiles reports a missing branch and a refused token', async () => {
    const missing = fakeFetch({ [`GET ${REPO}/branches/main`]: () => json(404, {}) });
    await assert.rejects(listMarkdownFiles({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: missing.fetch }), { message: 'Branch main not found' });
    const refused = fakeFetch({ [`GET ${REPO}/branches/main`]: () => json(401, {}) });
    await assert.rejects(listMarkdownFiles({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: refused.fetch }), { message: 'Token not accepted' });
});

test('listMarkdownFiles reports no connection with a recognizable error', async () => {
    await assert.rejects(
        listMarkdownFiles({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', token: TOKEN, fetch: async () => { throw new TypeError('Failed to fetch'); } }),
        err => err.offline === true && err.message === 'No connection to GitHub'
    );
});

test('getBlobText decodes a blob as UTF-8 text', async () => {
    const text = '---\ntitle: Café ✓\n---\nBody';
    const routes = { [`GET ${REPO}/git/blobs/s1`]: () => json(200, { encoding: 'base64', content: Buffer.from(text).toString('base64') }) };
    const { fetch } = fakeFetch(routes);
    assert.equal(await getBlobText({ owner: 'exhibita', repo: 'gtg-test-site', sha: 's1', token: TOKEN, fetch }), text);
});

// ---------- saveFile ----------

test('saveFile sends the text, the old SHA and the branch, and returns the new SHA', async () => {
    const sent = [];
    const fetch = async (url, init) => {
        sent.push({ url, method: init.method, body: JSON.parse(init.body), auth: init.headers.Authorization });
        return json(200, { content: { sha: 'NEWSHA' }, commit: { sha: 'COMMIT' } });
    };
    const text = '---\ntitle: "Café ✓"\n---\nBody\n';
    const result = await saveFile({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/blog/my post/index.md', text, sha: 'OLDSHA', message: 'Edit', token: TOKEN, fetch });
    assert.deepEqual(result, { sha: 'NEWSHA', commitSha: 'COMMIT' });
    assert.equal(sent[0].method, 'PUT');
    assert.equal(sent[0].url, `${API}${REPO}/contents/src/blog/my%20post/index.md`);
    assert.equal(sent[0].auth, `Bearer ${TOKEN}`);
    assert.equal(sent[0].body.sha, 'OLDSHA');
    assert.equal(sent[0].body.branch, 'main');
    assert.equal(sent[0].body.message, 'Edit');
    assert.equal(Buffer.from(sent[0].body.content, 'base64').toString('utf8'), text);
});

test('saveFile stops when the file changed on GitHub, so nothing is overwritten', async () => {
    for (const status of [409, 422]) {
        const fetch = async () => json(status, { message: 'src/x/index.md does not match OLDSHA' });
        await assert.rejects(
            saveFile({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/x/index.md', text: 'x', sha: 'OLDSHA', message: 'Edit', token: TOKEN, fetch }),
            err => err.conflict === true && err.message === 'This page changed on GitHub after you opened it.'
        );
    }
});

test('saveFile reports a refused token, no write access and no connection', async () => {
    const save = fetch => saveFile({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/x/index.md', text: 'x', sha: 'S', message: 'Edit', token: TOKEN, fetch });
    await assert.rejects(save(async () => json(401, {})), { message: 'Token not accepted' });
    await assert.rejects(save(async () => json(403, {})), { message: 'No write access' });
    await assert.rejects(save(async () => { throw new TypeError('Failed to fetch'); }), err => err.offline === true);
});

// After a refused or timed-out save, the app reads the file: when it already has the user's text,
// the save is a success (the first request reached GitHub), not a conflict.
const fileRoute = (text, sha) => () => json(200, { sha, content: Buffer.from(text).toString('base64'), encoding: 'base64' });
const saveArgs = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/x/index.md', text: 'NEW TEXT', sha: 'OLDSHA', message: 'Edit', token: TOKEN };

test('saveFile: a 409 for a file that already has the user text is a success', async () => {
    const { fetch } = fakeFetch({
        [`PUT ${REPO}/contents/src/x/index.md`]: () => json(409, {}),
        [`GET ${REPO}/contents/src/x/index.md?ref=main`]: fileRoute('NEW TEXT', 'SAVEDSHA')
    });
    assert.deepEqual(await saveFile({ ...saveArgs, fetch }), { sha: 'SAVEDSHA' });
});

test('saveFile: a 409 for a file with other text is a conflict', async () => {
    const { fetch } = fakeFetch({
        [`PUT ${REPO}/contents/src/x/index.md`]: () => json(409, {}),
        [`GET ${REPO}/contents/src/x/index.md?ref=main`]: fileRoute('SOMEONE ELSE', 'OTHERSHA')
    });
    await assert.rejects(saveFile({ ...saveArgs, fetch }), err => err.conflict === true);
});

test('saveFile: a 422 while the file is unchanged on GitHub is an error, not a conflict', async () => {
    const { fetch } = fakeFetch({
        [`PUT ${REPO}/contents/src/x/index.md`]: () => json(422, {}),
        [`GET ${REPO}/contents/src/x/index.md?ref=main`]: fileRoute('OLD TEXT', 'OLDSHA')
    });
    await assert.rejects(saveFile({ ...saveArgs, fetch }), err => !err.conflict && err.message === 'GitHub error 422');
});

test('saveFile: when the save times out but GitHub saved it, the app finds the saved file', async () => {
    let puts = 0;
    const routes = { [`GET ${REPO}/contents/src/x/index.md?ref=main`]: fileRoute('NEW TEXT', 'SAVEDSHA') };
    const fetch = async (url, init = {}) => {
        if (init.method === 'PUT') {
            puts++;
            throw new TypeError('Failed to fetch');
        }
        return routes[`GET ${url.replace(API, '')}`]();
    };
    assert.deepEqual(await saveFile({ ...saveArgs, fetch }), { sha: 'SAVEDSHA' });
    assert.equal(puts, 1);
});

// ---------- pathExists ----------

test('pathExists asks GitHub for the folder or file on the branch', async () => {
    const { fetch, calls } = fakeFetch({
        [`GET ${REPO}/contents/src/blog/taken?ref=main`]: () => json(200, [{ name: 'index.md' }]),
        [`GET ${REPO}/contents/src/blog/free?ref=main`]: () => json(404, {})
    });
    const ask = path => pathExists({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path, token: TOKEN, fetch });
    assert.equal(await ask('src/blog/taken'), true);
    assert.equal(await ask('src/blog/free'), false);
    assert.ok(calls.every(c => c.headers.Authorization === `Bearer ${TOKEN}`));
});

test('pathExists reports a refused token and no connection', async () => {
    const ask = fetch => pathExists({ owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/x', token: TOKEN, fetch });
    await assert.rejects(ask(async () => json(401, {})), { message: 'Token not accepted' });
    await assert.rejects(ask(async () => { throw new TypeError('Failed to fetch'); }), err => err.offline === true);
});

test('saveFile for a new page: a 409 with no file on GitHub is not "the page exists"', async () => {
    const { fetch } = fakeFetch({
        [`PUT ${REPO}/contents/src/x/index.md`]: () => json(409, {}),
        [`GET ${REPO}/contents/src/x/index.md?ref=main`]: () => json(404, {})
    });
    await assert.rejects(saveFile({ ...saveArgs, sha: undefined, fetch }), err => !err.conflict && /Try again/.test(err.message));
});

test('saveFile for a new page: a refusal because the file exists is a conflict', async () => {
    const { fetch } = fakeFetch({
        [`PUT ${REPO}/contents/src/x/index.md`]: () => json(422, {}),
        [`GET ${REPO}/contents/src/x/index.md?ref=main`]: fileRoute('SOMEONE ELSE', 'THEIRSHA')
    });
    await assert.rejects(saveFile({ ...saveArgs, sha: undefined, fetch }), err => err.conflict === true);
});

// ---------- deleteFile ----------

const deleteArgs = { owner: 'exhibita', repo: 'gtg-test-site', branch: 'main', path: 'src/blog/old/index.md', sha: 'OPENEDSHA', message: 'Delete old', token: TOKEN };
const FILE = `${REPO}/contents/src/blog/old/index.md`;

test('deleteFile sends the SHA the user opened, the branch and the message', async () => {
    const sent = [];
    const fetch = async (url, init) => {
        sent.push({ url, method: init.method, body: JSON.parse(init.body) });
        return json(200, { commit: { sha: 'C' } });
    };
    await deleteFile({ ...deleteArgs, fetch });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].method, 'DELETE');
    assert.equal(sent[0].url, `${API}${FILE}`);
    assert.deepEqual(sent[0].body, { message: 'Delete old', sha: 'OPENEDSHA', branch: 'main' });
});

test('deleteFile stops when the page changed on GitHub, so nothing is deleted', async () => {
    const { fetch } = fakeFetch({
        [`DELETE ${FILE}`]: () => json(409, {}),
        [`GET ${FILE}?ref=main`]: fileRoute('NEWER TEXT', 'NEWERSHA')
    });
    await assert.rejects(deleteFile({ ...deleteArgs, fetch }), err => err.conflict === true && err.message === 'This page changed on GitHub after you opened it.');
});

test('deleteFile: a page that is already gone counts as deleted', async () => {
    for (const status of [404, 409]) {
        const { fetch } = fakeFetch({
            [`DELETE ${FILE}`]: () => json(status, {}),
            [`GET ${FILE}?ref=main`]: () => json(404, {}),
            [`GET ${REPO}/branches/main`]: () => json(200, {})
        });
        await deleteFile({ ...deleteArgs, fetch });
    }
});

test('deleteFile: "not found" with a branch that cannot be read is an error, not a delete', async () => {
    // The token lost access, or the branch was renamed: GitHub then says "not found" for the file too.
    const { fetch } = fakeFetch({
        [`DELETE ${FILE}`]: () => json(404, {}),
        [`GET ${FILE}?ref=main`]: () => json(404, {}),
        [`GET ${REPO}/branches/main`]: () => json(404, {})
    });
    await assert.rejects(deleteFile({ ...deleteArgs, fetch }), err => !err.conflict && /Branch main not found|No write access/.test(err.message));
});

test('deleteFile: a refusal when the check cannot reach GitHub says "No connection"', async () => {
    const fetch = async (url, init = {}) => {
        if (init.method === 'DELETE') return json(404, {});
        throw new TypeError('Failed to fetch');
    };
    await assert.rejects(deleteFile({ ...deleteArgs, fetch }), err => err.offline === true);
});

test('deleteFile: a delete that timed out but reached GitHub is a success', async () => {
    const routes = { [`GET ${FILE}?ref=main`]: () => json(404, {}), [`GET ${REPO}/branches/main`]: () => json(200, {}) };
    const fetch = async (url, init = {}) => {
        if (init.method === 'DELETE') throw new TypeError('Failed to fetch');
        return routes[`GET ${url.replace(API, '')}`]();
    };
    await deleteFile({ ...deleteArgs, fetch });
});

test('deleteFile reports no connection when the file is still there, and a refused token', async () => {
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(deleteFile({ ...deleteArgs, fetch: offline }), err => err.offline === true);
    await assert.rejects(deleteFile({ ...deleteArgs, fetch: async () => json(401, {}) }), { message: 'Token not accepted' });
});

test('deleteFile: no write access when GitHub refuses and the file is unchanged', async () => {
    const { fetch } = fakeFetch({
        [`DELETE ${FILE}`]: () => json(403, {}),
        [`GET ${FILE}?ref=main`]: fileRoute('SAME TEXT', 'OPENEDSHA')
    });
    await assert.rejects(deleteFile({ ...deleteArgs, fetch }), { message: 'No write access' });
});
