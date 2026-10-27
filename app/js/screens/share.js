// The Share screen (Android share sheet): choose a site and a gallery for the photos that the user shared.
// The service worker keeps the photos in a cache. The gallery editor takes them and adds them (spec section 7.3).
import { getToken } from '../auth.js';
import { listSites } from '../sites.js';
import { loadPages } from '../pages.js';
import { readShare, deleteShare, pruneShares } from '../share-store.js';
import { setIncoming } from '../incoming.js';
import { escapeHtml, icon } from '../dom.js';
import { navigate } from '../router.js';
import { galleryPickerHtml, shareIntroText } from './gallery-picker.js';

export async function shareScreen(container, [shareId]) {
    pruneShares().catch(() => {}); // Old shares that nobody finished.
    const sites = await listSites();
    if (sites.length === 0) {
        navigate('#/', { replace: true });
        return;
    }
    let files = [];
    let readFailed = false;
    try {
        files = await readShare(shareId);
    } catch {
        readFailed = true;
    }

    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="#/" aria-label="Back to the pages">${icon('back', 22)}</a>
        <h1 tabindex="-1">Share</h1>
    </header>
    <div class="screen-body" id="share-body"></div>
</div>`;
    const body = container.querySelector('#share-body');
    let closed = false;

    if (files.length === 0) {
        body.innerHTML = `<p class="empty">${readFailed ? 'The app cannot read the photos. Share them again.' : shareIntroText(0)}</p>`;
        return;
    }

    const showGalleries = async site => {
        body.innerHTML = '<p class="muted" role="status"><span class="spinner"></span> Loading galleries</p>';
        try {
            const token = await getToken(site.id);
            if (!token) throw new Error('No token on this device. Remove the site and add it again.');
            const { pages } = await loadPages({ site, token });
            if (closed) return;
            body.innerHTML = `<h2 class="card-title section-title">${shareIntroText(files.length)}</h2>
<p class="muted small">${escapeHtml(site.name)}</p>
${galleryPickerHtml(pages, site.id)}
${sites.length > 1 ? '<button type="button" class="btn btn-secondary" id="change-site">Choose another site</button>' : ''}`;
            body.querySelector('#change-site')?.addEventListener('click', showSites);
            for (const row of body.querySelectorAll('button[data-path]')) {
                row.addEventListener('click', () => {
                    const { path } = row.dataset;
                    setIncoming({ siteId: site.id, path, files, origins: files.map(() => null), onKept: () => deleteShare(shareId) });
                    navigate(`#/site/${encodeURIComponent(site.id)}/edit/${encodeURIComponent(path)}`);
                });
            }
        } catch (err) {
            if (closed) return;
            body.innerHTML = `<div class="banner" role="alert">${escapeHtml(err.message)}</div>
<button type="button" class="btn btn-secondary" id="retry">Try again</button>`;
            body.querySelector('#retry').addEventListener('click', () => showGalleries(site));
        }
    };

    function showSites() {
        body.innerHTML = `<h2 class="card-title section-title">${shareIntroText(files.length)}</h2>
<p class="muted small">Choose a site.</p>
<ul class="page-list">${sites.map(site => `<li><button type="button" class="pick-row" data-site="${escapeHtml(site.id)}">
    <span class="page-card-text"><span class="page-card-title">${escapeHtml(site.name)}</span>
    <span class="muted small">${escapeHtml(site.owner)}/${escapeHtml(site.repo)}</span></span>${icon('chevronRight', 18)}</button></li>`).join('')}</ul>`;
        for (const row of body.querySelectorAll('button[data-site]')) {
            row.addEventListener('click', () => showGalleries(sites.find(site => site.id === row.dataset.site)));
        }
    }

    if (sites.length === 1) showGalleries(sites[0]);
    else showSites();

    return () => {
        closed = true;
    };
}
