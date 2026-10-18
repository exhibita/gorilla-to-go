// The site screen. In this version: site details, the template version check, the site switcher,
// and "Remove this site". The page list comes in build step 3.
import { getTemplateVersion, REQUIRED_TEMPLATE_VERSION } from '../github.js';
import { getToken } from '../auth.js';
import { getSite, listSites, removeSite, setLastSiteId, updateSite } from '../sites.js';
import { escapeHtml, icon } from '../dom.js';
import { navigate } from '../router.js';
import { themeToggleHtml, bindThemeToggles } from '../theme.js';

function templateRowHtml(status, label, helpHtml = '') {
    const icons = { pass: icon('check', 14, 3), fail: icon('cross', 14, 3), running: '<span class="spinner"></span>', waiting: '' };
    const statusText = { pass: 'Passed', fail: 'Failed', running: 'Checking', waiting: 'Not checked' }[status];
    return `<li class="check check--${status}">
        <span class="check-icon" aria-hidden="true">${icons[status]}</span>
        <span class="check-text"><span class="check-label"><span class="visually-hidden">${statusText}: </span>${escapeHtml(label)}</span>${helpHtml}</span>
    </li>`;
}

// Check the template version again each time the site opens (mvp-plan section 4).
async function checkTemplate(site, row) {
    row.innerHTML = templateRowHtml('running', 'Checking the template version');
    const token = await getToken(site.id);
    if (!token) {
        row.innerHTML = templateRowHtml('fail', 'No token on this device. Remove the site and add it again.');
        return;
    }
    const result = await getTemplateVersion({ ...site, token });
    if (!result.ok) {
        if (result.label === 'No connection to GitHub') {
            row.innerHTML = templateRowHtml('waiting', 'Not checked: no connection to GitHub');
        } else if (result.label === 'Token not accepted') {
            row.innerHTML = templateRowHtml('fail', 'Token not accepted. The token can be expired or deleted. Remove the site and add it again with a new token.',
                '<a class="text-link text-link--small" href="#/help/token">How to create a token</a>');
        } else {
            row.innerHTML = templateRowHtml('fail', result.label);
        }
        return;
    }
    if (result.version !== site.templateVersion) await updateSite({ ...site, templateVersion: result.version });
    const label = `Template version ${result.version} (required: ${REQUIRED_TEMPLATE_VERSION})`;
    row.innerHTML = result.version >= REQUIRED_TEMPLATE_VERSION
        ? templateRowHtml('pass', label)
        : templateRowHtml('fail', label, '<a class="text-link text-link--small" href="#/help/upgrade">How to upgrade the site</a>');
}

export async function siteScreen(container, [id]) {
    const site = await getSite(id);
    if (!site) {
        navigate('#/', { replace: true });
        return;
    }
    setLastSiteId(site.id);
    const sites = await listSites();
    const name = escapeHtml(site.name);
    const repoUrl = `https://github.com/${encodeURIComponent(site.owner)}/${encodeURIComponent(site.repo)}`;

    container.innerHTML = `
<div class="screen">
    <div class="header-row">
        <button type="button" class="site-switch" id="open-switcher" aria-haspopup="dialog" aria-label="Site: ${name}. Change site.">
            <span class="dot" aria-hidden="true"></span><span>${name}</span>${icon('chevronDown', 16)}
        </button>
        ${themeToggleHtml()}
    </div>
    <div class="screen-body">
        <div>
            <h1 class="page-title" tabindex="-1">${name}</h1>
            <p class="site-meta">${escapeHtml(site.owner)}/${escapeHtml(site.repo)} · ${escapeHtml(site.branch)}</p>
        </div>
        <section class="card" aria-label="Template version">
            <ul class="checks"><li id="template-row"></li></ul>
        </section>
        <section class="card">
            <h2 class="card-title">Pages</h2>
            <p class="muted">The page list comes in the next version of the app.</p>
        </section>
        <a class="text-link text-link--small" href="${repoUrl}" target="_blank" rel="noopener noreferrer">Open the repository on GitHub ${icon('external', 14)}</a>
    </div>
    <div class="screen-footer">
        <button type="button" class="btn btn-danger" id="open-remove">Remove this site</button>
    </div>

    <dialog class="sheet" id="switcher" aria-labelledby="switcher-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="switcher-title">Sites</h2>
            <ul class="sheet-list">
                ${sites.map(s => `<li><button type="button" class="sheet-item" data-site="${escapeHtml(s.id)}" aria-current="${s.id === site.id}">
                    <span class="dot" aria-hidden="true"></span>
                    <span class="sheet-item-text"><span>${escapeHtml(s.name)}</span><span class="muted small">${escapeHtml(s.owner)}/${escapeHtml(s.repo)} · ${escapeHtml(s.branch)}</span></span>
                </button></li>`).join('')}
            </ul>
            <a class="btn btn-secondary" href="#/add">${icon('plus', 20, 2.2)} Add a site</a>
            <button type="button" class="btn btn-secondary" data-close>Close</button>
        </div>
    </dialog>

    <dialog class="sheet" id="remove" aria-labelledby="remove-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="remove-title">Remove ${name}?</h2>
            <p>The app deletes this site and its token from this device. The repository on GitHub does not change.</p>
            <p class="message-error" id="remove-error" role="alert"></p>
            <button type="button" class="btn btn-danger" id="confirm-remove">Remove site</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </div>
    </dialog>
</div>`;

    const $ = selector => container.querySelector(selector);
    bindThemeToggles(container);

    for (const dialog of container.querySelectorAll('dialog')) {
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        // A tap on the dark area outside the sheet closes it.
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close();
        });
    }

    $('#open-switcher').addEventListener('click', () => $('#switcher').showModal());
    for (const button of container.querySelectorAll('[data-site]')) {
        button.addEventListener('click', () => {
            $('#switcher').close();
            if (button.dataset.site !== site.id) navigate(`#/site/${encodeURIComponent(button.dataset.site)}`);
        });
    }
    $('#switcher a[href="#/add"]').addEventListener('click', () => $('#switcher').close());

    $('#open-remove').addEventListener('click', () => $('#remove').showModal());
    $('#confirm-remove').addEventListener('click', async () => {
        try {
            await removeSite(site.id);
        } catch {
            $('#remove-error').textContent = 'The app cannot remove the site. Try again.';
            return;
        }
        $('#remove').close();
        navigate('#/', { replace: true });
    });

    const templateRow = $('#template-row');
    checkTemplate(site, templateRow).catch(() => {
        templateRow.innerHTML = templateRowHtml('waiting', 'Not checked: the app cannot read its stored data');
    });
}
