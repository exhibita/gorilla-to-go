import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoInput, checkSite, getTemplateVersion, REQUIRED_TEMPLATE_VERSION } from '../app/js/github.js';

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
