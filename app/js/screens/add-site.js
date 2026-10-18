// Add a site: repository, branch, name, token, and the checks. The checks run automatically
// after the token is entered (decision 15). "Add site" is available only when all checks pass.
import { parseRepoInput, checkSite, CHECKS } from '../github.js';
import { defaultName } from '../sites-logic.js';
import { addSite, DuplicateSiteError } from '../sites.js';
import { escapeHtml, icon } from '../dom.js';
import { back, navigate } from '../router.js';

const CHECK_DELAY_MS = 600;

// The values on this screen, in memory only, so they stay when the user opens a help page and comes back.
// The token is stored only when the user taps "Add site".
const draft = { repo: '', branch: 'main', name: '', token: '' };

function clearDraft() {
    Object.assign(draft, { repo: '', branch: 'main', name: '', token: '' });
}

function checkRowHtml(check) {
    const icons = {
        pass: icon('check', 14, 3),
        fail: icon('cross', 14, 3),
        running: '<span class="spinner"></span>',
        waiting: ''
    };
    let helpLink = '';
    if (check.status === 'fail') {
        helpLink = check.help === 'upgrade'
            ? '<a class="text-link text-link--small" href="#/help/upgrade">How to upgrade the site</a>'
            : '<a class="text-link text-link--small" href="#/help/token">How to create a token</a>';
        if (check.label === 'No connection to GitHub') helpLink = '';
    }
    const statusText = { pass: 'Passed', fail: 'Failed', running: 'Checking', waiting: 'Not checked yet' }[check.status];
    return `<li class="check check--${check.status}">
        <span class="check-icon" aria-hidden="true">${icons[check.status]}</span>
        <span class="check-text"><span class="check-label"><span class="visually-hidden">${statusText}: </span>${escapeHtml(check.label)}</span>${helpLink}</span>
    </li>`;
}

export function addSiteScreen(container) {
    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="#/" data-back aria-label="Back">${icon('back', 22)}</a>
        <h1 tabindex="-1">Add a site</h1>
    </header>
    <form class="screen-body" id="add-form" novalidate>
        <div class="field">
            <label for="repo">GitHub repository</label>
            <input class="input" id="repo" type="text" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="owner/repository" aria-describedby="repo-hint" value="${escapeHtml(draft.repo)}">
            <div class="field-hint" id="repo-hint">Type owner/repository, or paste the repository URL.</div>
        </div>
        <div class="field-row">
            <div class="field">
                <label for="branch">Branch</label>
                <input class="input" id="branch" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${escapeHtml(draft.branch)}">
            </div>
            <div class="field">
                <label for="name">Name in the app</label>
                <input class="input" id="name" type="text" autocomplete="off" value="${escapeHtml(draft.name)}">
            </div>
        </div>
        <div class="field">
            <label for="token">Personal access token</label>
            <div class="input-group">
                <input id="token" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${escapeHtml(draft.token)}">
                <button type="button" class="icon-btn icon-btn--plain" id="show-token" aria-label="Show token" aria-pressed="false">${icon('eye')}</button>
                <button type="button" class="btn-small" id="paste-token">Paste</button>
            </div>
            <a class="text-link text-link--small" href="#/help/token">How to create a token</a>
        </div>
        <section class="card" aria-labelledby="checks-title">
            <h2 class="card-title" id="checks-title">Checks</h2>
            <ul class="checks" id="checks"></ul>
            <p class="field-hint" id="checks-hint">The checks start when the repository, the branch and the token are filled in.</p>
        </section>
        <div class="message-error" id="add-error" role="alert"></div>
    </form>
    <div class="screen-footer">
        <button type="submit" form="add-form" class="btn btn-primary" id="add-site" disabled>Add site</button>
    </div>
</div>`;

    const $ = id => container.querySelector(`#${id}`);
    const repoInput = $('repo');
    const branchInput = $('branch');
    const nameInput = $('name');
    const tokenInput = $('token');
    const addButton = $('add-site');
    const errorBox = $('add-error');

    let timer = null;
    let runId = 0;
    let passed = null; // The result of the last check run, when all checks passed.

    const renderChecks = results => {
        $('checks').innerHTML = results ? results.map(checkRowHtml).join('') : '';
        $('checks-hint').hidden = Boolean(results);
    };

    const updateNamePlaceholder = () => {
        nameInput.placeholder = defaultName(parseRepoInput(draft.repo));
    };

    const scheduleChecks = () => {
        clearTimeout(timer);
        runId++;
        passed = null;
        addButton.disabled = true;
        errorBox.textContent = '';

        const parsed = parseRepoInput(draft.repo);
        repoInput.setAttribute('aria-invalid', String(Boolean(draft.repo.trim()) && !parsed));
        if (!parsed || !draft.branch.trim() || !draft.token.trim()) {
            renderChecks(null);
            return;
        }
        renderChecks(CHECKS.map(check => ({ ...check, status: 'waiting' })));
        timer = setTimeout(() => runChecks(parsed), CHECK_DELAY_MS);
    };

    const runChecks = async parsed => {
        const id = ++runId;
        const branch = draft.branch.trim();
        const result = await checkSite({
            ...parsed,
            branch,
            token: draft.token.trim(),
            onUpdate: results => {
                if (id === runId) renderChecks(results);
            }
        });
        if (id !== runId) return; // A newer run started: ignore this one.
        if (result.ok) {
            passed = { ...parsed, branch, templateVersion: result.templateVersion };
            addButton.disabled = false;
        }
    };

    for (const [input, key] of [[repoInput, 'repo'], [branchInput, 'branch'], [tokenInput, 'token']]) {
        input.addEventListener('input', () => {
            draft[key] = input.value;
            if (key === 'repo') updateNamePlaceholder();
            scheduleChecks();
        });
    }
    nameInput.addEventListener('input', () => {
        draft.name = nameInput.value;
    });

    $('show-token').addEventListener('click', event => {
        const button = event.currentTarget;
        const show = tokenInput.type === 'password';
        tokenInput.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(show));
        button.setAttribute('aria-label', show ? 'Hide token' : 'Show token');
        button.innerHTML = icon(show ? 'eyeOff' : 'eye');
    });

    $('paste-token').addEventListener('click', async () => {
        try {
            const text = (await navigator.clipboard.readText()).trim();
            if (!text) throw new Error('empty clipboard');
            tokenInput.value = text;
            tokenInput.dispatchEvent(new Event('input'));
        } catch {
            errorBox.textContent = 'The app cannot read the clipboard. Touch and hold the token field, then tap Paste.';
            tokenInput.focus();
        }
    });

    container.querySelector('[data-back]').addEventListener('click', event => {
        event.preventDefault();
        clearDraft();
        back('#/');
    });

    $('add-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (!passed) return;
        addButton.disabled = true;
        errorBox.textContent = '';
        try {
            const site = await addSite({
                owner: passed.owner,
                repo: passed.repo,
                branch: passed.branch,
                name: draft.name.trim() || defaultName(passed),
                templateVersion: passed.templateVersion
            }, draft.token.trim());
            clearDraft();
            navigate(`#/site/${encodeURIComponent(site.id)}`, { replace: true });
        } catch (err) {
            errorBox.textContent = err instanceof DuplicateSiteError
                ? err.message
                : 'The app could not save the site on this device. Try again.';
            addButton.disabled = false;
        }
    });

    updateNamePlaceholder();
    scheduleChecks();

    return () => {
        clearTimeout(timer);
        runId++;
    };
}
