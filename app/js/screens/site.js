// The site screen: the Pages list (mvp-plan section 6, screen 3), with search and type filters.
// The site sheet has the site details, the template version check, and "Remove this site".
import { getTemplateVersion, REQUIRED_TEMPLATE_VERSION } from '../github.js';
import { getToken } from '../auth.js';
import { getSite, listSites, removeSite, setLastSiteId, updateSite } from '../sites.js';
import { loadPages, deviceStore } from '../pages.js';
import { listNewPages } from '../edits.js';
import { parseFrontmatter } from '../frontmatter.js';
import { classifyPath, filterPages, formatDate, listTimeText, sortPages, TYPE_LABELS } from '../pages-logic.js';
import { escapeHtml, icon } from '../dom.js';
import { navigate } from '../router.js';
import { themeToggleHtml, bindThemeToggles } from '../theme.js';
import { aboutSheetHtml, bindAbout } from './about.js';

const FILTERS = [
    { type: 'all', label: 'All' },
    { type: 'blog', label: 'Blog' },
    { type: 'page', label: 'Pages' },
    { type: 'gallery', label: 'Galleries' }
];

// The search and filter stay the same when the user opens a page and comes back.
const view = { siteId: null, type: 'all', query: '' };

// The last list of each site in this session, so "Back" from a page shows it at once.
const lastLists = new Map();

// After a delete: the next visit shows the saved list without the page, not the remembered one.
export const forgetList = siteId => lastLists.delete(siteId);


// Type label, Draft label, date and image count of a page.
export function pageMetaHtml(page) {
    const parts = [`<span class="type-label type-label--${page.type}">${TYPE_LABELS[page.type]}</span>`];
    if (page.draft) parts.push('<span class="draft-label">Draft</span>');
    // The site build skips a page with front matter that is not valid, so the list must show it.
    if (page.error) parts.push('<span class="error-label">Front matter error</span>');
    if (page.date) parts.push(`<span>${escapeHtml(formatDate(page.date))}</span>`);
    if (page.type === 'gallery') parts.push(`<span>${page.imageCount} ${page.imageCount === 1 ? 'image' : 'images'}</span>`);
    return parts.join('');
}

export const pageHref = (siteId, path) => `#/site/${encodeURIComponent(siteId)}/page/${encodeURIComponent(path)}`;

function checkRowHtml(status, label, helpHtml = '') {
    const icons = { pass: icon('check', 14, 3), fail: icon('cross', 14, 3), running: '<span class="spinner"></span>', waiting: '' };
    const statusText = { pass: 'Passed', fail: 'Failed', running: 'Checking', waiting: 'Not checked' }[status];
    return `<li class="check check--${status}">
        <span class="check-icon" aria-hidden="true">${icons[status]}</span>
        <span class="check-text"><span class="check-label"><span class="visually-hidden">${statusText}: </span>${escapeHtml(label)}</span>${helpHtml}</span>
    </li>`;
}

const TOKEN_HELP = '<a class="text-link text-link--small" href="#/help/token">How to create a token</a>';
const UPGRADE_HELP = '<a class="text-link text-link--small" href="#/help/upgrade">How to upgrade the site</a>';

// Check the template version each time the site opens (mvp-plan section 4).
// Returns { status: 'pass'|'fail'|'waiting', label, helpHtml }.
async function templateStatus(site, token) {
    if (!token) return { status: 'fail', label: 'No token on this device. Remove the site and add it again.' };
    const result = await getTemplateVersion({ ...site, token });
    if (!result.ok) {
        if (result.label === 'No connection to GitHub') return { status: 'waiting', label: 'Not checked: no connection to GitHub' };
        if (result.label === 'Token not accepted') {
            return { status: 'fail', label: 'Token not accepted. The token is possibly expired or deleted. Remove the site and add it again with a new token.', helpHtml: TOKEN_HELP };
        }
        return { status: 'fail', label: result.label };
    }
    if (result.version !== site.templateVersion) await updateSite({ ...site, templateVersion: result.version });
    const label = `Template version ${result.version} (required: ${REQUIRED_TEMPLATE_VERSION})`;
    return result.version >= REQUIRED_TEMPLATE_VERSION ? { status: 'pass', label } : { status: 'fail', label, helpHtml: UPGRADE_HELP };
}

export async function siteScreen(container, [id]) {
    const site = await getSite(id);
    if (!site) {
        navigate('#/', { replace: true });
        return;
    }
    setLastSiteId(site.id);
    if (view.siteId !== site.id) Object.assign(view, { siteId: site.id, type: 'all', query: '' });
    const sites = await listSites();
    const name = escapeHtml(site.name);
    const repoUrl = `https://github.com/${encodeURIComponent(site.owner)}/${encodeURIComponent(site.repo)}`;

    container.innerHTML = `
<div class="screen">
    <div class="header-row">
        <button type="button" class="site-switch" id="open-switcher" aria-haspopup="dialog" aria-label="Site: ${name}. Change site.">
            <span class="dot" aria-hidden="true"></span><span>${name}</span>${icon('chevronDown', 16)}
        </button>
        <div class="header-actions">
            <button type="button" class="icon-btn" id="open-about" aria-haspopup="dialog" aria-label="About Gorilla To Go">${icon('help')}</button>
            <button type="button" class="icon-btn" id="open-site-sheet" aria-haspopup="dialog" aria-label="Site settings">${icon('settings')}</button>
            ${themeToggleHtml()}
        </div>
    </div>
    <div class="screen-body">
        <h1 class="page-title" tabindex="-1">Pages</h1>
        <div class="banner" id="template-banner" role="alert" hidden></div>
        <label class="search">
            ${icon('search', 18)}
            <input type="search" id="search" placeholder="Search pages" aria-label="Search pages" autocomplete="off" value="${escapeHtml(view.query)}">
        </label>
        <div class="filters" role="group" aria-label="Page type">
            ${FILTERS.map(f => `<button type="button" class="filter" data-type="${f.type}" aria-pressed="${view.type === f.type}">${f.label}</button>`).join('')}
        </div>
        <div class="list-meta">
            <span class="muted small" id="list-status" aria-live="polite"></span>
            <button type="button" class="btn-small" id="refresh">${icon('refresh', 16)} Refresh</button>
        </div>
        <section id="new-pages" hidden aria-labelledby="new-pages-title">
            <h2 class="card-title section-title" id="new-pages-title">Not published</h2>
            <ul class="page-list" id="new-page-list"></ul>
        </section>
        <ul class="page-list" id="page-list"></ul>
        <div id="list-message"></div>
        <a class="fab" href="#/site/${encodeURIComponent(site.id)}/new" aria-label="New page">${icon('plus', 28, 2.2)}</a>
    </div>

    ${aboutSheetHtml()}

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

    <dialog class="sheet" id="site-sheet" aria-labelledby="site-sheet-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="site-sheet-title">${name}</h2>
            <p class="site-meta">${escapeHtml(site.owner)}/${escapeHtml(site.repo)} · ${escapeHtml(site.branch)}</p>
            <ul class="checks"><li id="template-row"></li></ul>
            <a class="text-link text-link--small" href="${repoUrl}" target="_blank" rel="noopener noreferrer">Open the repository on GitHub ${icon('external', 14)}</a>
            <button type="button" class="btn btn-danger" id="open-remove">Remove this site</button>
            <button type="button" class="btn btn-secondary" data-close>Close</button>
        </div>
    </dialog>

    <dialog class="sheet" id="remove" aria-labelledby="remove-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="remove-title">Remove ${name}?</h2>
            <p>The app deletes this site, its token and its saved pages from this device. The repository on GitHub does not change.</p>
            <p class="banner" id="remove-new-pages" hidden></p>
            <p class="message-error" id="remove-error" role="alert"></p>
            <button type="button" class="btn btn-danger" id="confirm-remove">Remove site</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </div>
    </dialog>
</div>`;

    const $ = selector => container.querySelector(selector);
    bindThemeToggles(container);
    bindAbout(container, container.querySelector('#open-about'));
    const controller = new AbortController();
    let pages = null;

    // ----- Sheets -----
    for (const dialog of container.querySelectorAll('dialog')) {
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close(); // A tap on the dark area outside the sheet.
        });
    }
    $('#open-switcher').addEventListener('click', () => $('#switcher').showModal());
    $('#open-site-sheet').addEventListener('click', () => $('#site-sheet').showModal());
    for (const button of container.querySelectorAll('[data-site]')) {
        button.addEventListener('click', () => {
            $('#switcher').close();
            if (button.dataset.site !== site.id) navigate(`#/site/${encodeURIComponent(button.dataset.site)}`);
        });
    }
    $('#switcher a[href="#/add"]').addEventListener('click', () => $('#switcher').close());
    $('#open-remove').addEventListener('click', async () => {
        $('#site-sheet').close();
        // New pages that are not published exist only on this device: say that they go too.
        const newPages = await listNewPages(site.id).catch(() => []);
        const note = $('#remove-new-pages');
        note.textContent = newPages.length === 1
            ? 'This site has 1 new page that is not published. The app deletes it too.'
            : `This site has ${newPages.length} new pages that are not published. The app deletes them too.`;
        note.hidden = newPages.length === 0;
        $('#remove').showModal();
    });
    $('#confirm-remove').addEventListener('click', async () => {
        // Stop a running load first, so it does not save the list of the removed site.
        currentLoad?.abort();
        try {
            await removeSite(site.id);
        } catch {
            $('#remove-error').textContent = 'The app cannot remove the site. Try again.';
            return;
        }
        lastLists.delete(site.id);
        $('#remove').close();
        navigate('#/', { replace: true });
    });

    // ----- List -----
    const status = text => {
        $('#list-status').textContent = text;
    };
    const message = html => {
        $('#list-message').innerHTML = html;
    };

    const renderList = () => {
        if (!pages) return;
        const shown = filterPages(pages, view);
        $('#page-list').innerHTML = shown.map(page => `<li><a class="page-card" href="${pageHref(site.id, page.path)}">
            <span class="page-card-text">
                <span class="page-meta">${pageMetaHtml(page)}</span>
                <span class="page-card-title">${escapeHtml(page.title)}</span>
            </span>${icon('chevronRight', 18)}</a></li>`).join('');
        if (pages.length === 0) message('<p class="empty">No pages yet.</p>');
        else if (shown.length === 0) message('<p class="empty">No pages match the search.</p>');
        else message('');
    };

    $('#search').addEventListener('input', event => {
        view.query = event.target.value;
        renderList();
    });
    for (const button of container.querySelectorAll('[data-type]')) {
        button.addEventListener('click', () => {
            view.type = button.dataset.type;
            for (const other of container.querySelectorAll('[data-type]')) other.setAttribute('aria-pressed', String(other === button));
            renderList();
        });
    }

    // Each load has its own stop signal. A newer load, or leaving the screen, stops the older one,
    // so an old load can never change what the screen shows.
    let currentLoad = null;
    const load = async () => {
        currentLoad?.abort();
        const thisLoad = new AbortController();
        currentLoad = thisLoad;
        const stop = () => thisLoad.abort();
        controller.signal.addEventListener('abort', stop);
        const isCurrent = () => currentLoad === thisLoad && !thisLoad.signal.aborted;

        $('#refresh').disabled = true;
        status(pages ? 'Looking for changes' : 'Loading pages');
        try {
            const token = await getToken(site.id);
            if (!token) throw Object.assign(new Error('No token on this device. Remove the site and add it again.'), { noToken: true });
            const result = await loadPages({
                site,
                token,
                signal: thisLoad.signal,
                onProgress: ({ done, total }) => {
                    if (total > 0 && isCurrent()) status(`Loading pages: ${done} of ${total}`);
                }
            });
            if (!isCurrent()) return;
            pages = result.pages;
            lastLists.set(site.id, result);
            renderList();
            status(result.offline ? `No connection. This list is from ${listTimeText(result.fetchedAt)}.` : `Updated ${listTimeText(result.fetchedAt)}`);
            if (result.truncated) message('<p class="empty">The repository is very large. Some pages can be missing from the list.</p>');
        } catch (err) {
            if (!isCurrent()) return;
            status('');
            const help = err.message === 'Token not accepted' || err.noToken ? TOKEN_HELP : '';
            if (pages) {
                status(err.message);
            } else {
                message(`<div class="banner">${escapeHtml(err.message)}${help}</div>`);
            }
        } finally {
            controller.signal.removeEventListener('abort', stop);
            if (isCurrent()) $('#refresh').disabled = false;
        }
    };

    $('#refresh').addEventListener('click', load);

    // Show the last list at once (this session, else the device cache), then look for changes.
    const remembered = lastLists.get(site.id);
    const saved = remembered ? null : await deviceStore.getPageList(site.id).catch(() => null);
    if (remembered) pages = remembered.pages;
    else if (saved) pages = sortPages(saved.pages);
    renderList();
    load();

    // New pages that are kept on this device and not published yet (build step 5).
    listNewPages(site.id).then(newPages => {
        if (controller.signal.aborted || newPages.length === 0) return;
        $('#new-page-list').innerHTML = newPages.map(edit => {
            const kind = classifyPath(edit.path);
            const title = parseFrontmatter(edit.text).data.title || kind.slug;
            return `<li><a class="page-card" href="#/site/${encodeURIComponent(site.id)}/edit/${encodeURIComponent(edit.path)}">
                <span class="page-card-text">
                    <span class="page-meta"><span class="type-label type-label--${kind.type}">${TYPE_LABELS[kind.type]}</span><span class="draft-label">Not published</span></span>
                    <span class="page-card-title">${escapeHtml(String(title))}</span>
                </span>${icon('chevronRight', 18)}</a></li>`;
        }).join('');
        $('#new-pages').hidden = false;
    }).catch(() => {});

    // ----- Template version -----
    getToken(site.id)
        .then(token => templateStatus(site, token))
        .catch(() => ({ status: 'waiting', label: 'Not checked: the app cannot read its stored data' }))
        .then(result => {
            if (controller.signal.aborted) return;
            $('#template-row').innerHTML = checkRowHtml(result.status, result.label, result.helpHtml);
            if (result.status === 'fail') {
                const banner = $('#template-banner');
                banner.innerHTML = `<span>${escapeHtml(result.label)}</span>${result.helpHtml ?? ''}`;
                banner.hidden = false;
            }
        });
    $('#template-row').innerHTML = checkRowHtml('running', 'Checking the template version');

    return () => controller.abort();
}
