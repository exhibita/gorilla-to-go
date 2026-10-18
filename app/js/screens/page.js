// Page view: one page for reading. It shows the front matter and the Markdown text, and opens the editor.
import { getToken } from '../auth.js';
import { getLocalEdit, deleteLocalEdit } from '../edits.js';
import { getSite } from '../sites.js';
import { getPageText, deviceStore, recordDeletedPage } from '../pages.js';
import { parseFrontmatter } from '../frontmatter.js';
import { classifyPath, pageSummary } from '../pages-logic.js';
import { escapeHtml, icon } from '../dom.js';
import { back, navigate } from '../router.js';
import { pageMetaHtml, forgetList } from './site.js';
import { deleteFile } from '../github.js';

// Delete the page (mvp-plan section 5): confirmation first, then one commit with the SHA the user
// opened, so a page that changed on GitHub is not deleted.
function bindDelete({ container, site, path, entry, slug, token, siteHref }) {
    const $ = selector => container.querySelector(selector);
    const dialog = $('#delete-page');
    let deleting = false;
    const warnBeforeClose = event => {
        event.preventDefault();
        event.returnValue = '';
    };
    dialog.querySelector('[data-close]').addEventListener('click', () => {
        if (!deleting) dialog.close();
    });
    // Escape and the Android back gesture also close a dialog: not while the delete runs.
    dialog.addEventListener('cancel', event => {
        if (deleting) event.preventDefault();
    });
    $('#open-delete-page').addEventListener('click', () => {
        $('#delete-error').textContent = '';
        $('#delete-status').textContent = '';
        dialog.showModal();
    });
    $('#confirm-delete-page').addEventListener('click', async () => {
        if (deleting) return; // One request for two quick taps.
        deleting = true;
        $('#confirm-delete-page').disabled = true;
        $('#delete-error').textContent = '';
        $('#delete-status').textContent = 'Deleting. Keep the app open until this is complete.';
        window.addEventListener('beforeunload', warnBeforeClose);
        try {
            await deleteFile({
                owner: site.owner,
                repo: site.repo,
                branch: site.branch,
                path,
                sha: entry.sha,
                message: `Delete ${slug} with Gorilla To Go`,
                token
            });
            await recordDeletedPage({ site, path }).catch(() => {});
            await deleteLocalEdit(site.id, path).catch(() => {});
            forgetList(site.id);
            // Only when this page view is still open: the user can have opened another screen meanwhile.
            if (container.isConnected) {
                dialog.close();
                back(siteHref);
            }
        } catch (err) {
            $('#delete-status').textContent = '';
            $('#delete-error').textContent = err.conflict
                ? 'This page changed on GitHub after you opened it. The app did not delete it. Go back to the pages and tap Refresh.'
                : err.offline
                    ? 'No connection. The page is not deleted.'
                    : `The page is not deleted: ${err.message}.`;
        } finally {
            deleting = false;
            $('#confirm-delete-page').disabled = false;
            window.removeEventListener('beforeunload', warnBeforeClose);
        }
    });
}

const githubFileUrl = (site, path) =>
    `https://github.com/${encodeURIComponent(site.owner)}/${encodeURIComponent(site.repo)}/blob/` +
    `${site.branch.split('/').map(encodeURIComponent).join('/')}/${path.split('/').map(encodeURIComponent).join('/')}`;

// A front matter value as text for the table.
function valueText(value) {
    if (value === null) return '(empty)';
    if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
    return String(value);
}

export async function pageScreen(container, [siteId, path]) {
    const site = await getSite(siteId);
    if (!site || !classifyPath(path)) {
        navigate('#/', { replace: true });
        return;
    }
    const siteHref = `#/site/${encodeURIComponent(site.id)}`;

    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="${siteHref}" data-back aria-label="Back to the pages">${icon('back', 22)}</a>
        <span class="muted small">${escapeHtml(site.name)}</span>
    </header>
    <div class="screen-body" id="page-body">
        <h1 class="page-title" tabindex="-1">${escapeHtml(classifyPath(path).slug)}</h1>
        <p class="muted" id="page-status" aria-live="polite">Loading the page</p>
    </div>
</div>`;
    container.querySelector('[data-back]').addEventListener('click', event => {
        event.preventDefault();
        back(siteHref);
    });

    const controller = new AbortController();
    const body = container.querySelector('#page-body');

    try {
        const list = await deviceStore.getPageList(site.id);
        const entry = list?.pages.find(page => page.path === path);
        if (!entry) throw new Error('This page is not in the saved list. Go back to the pages and tap Refresh.');
        const token = await getToken(site.id);
        const text = await getPageText({ site, token, sha: entry.sha, signal: controller.signal });
        if (controller.signal.aborted) return;

        const frontmatter = parseFrontmatter(text);
        const localEdit = await getLocalEdit(site.id, path).catch(() => null);
        const hasLocalEdit = Boolean(localEdit && localEdit.text !== text);
        const page = pageSummary(path, entry.sha, frontmatter);
        const { data } = frontmatter;
        const fields = Object.entries(data).filter(([key]) => key !== 'title' && key !== 'description' && key !== 'images');
        const images = Array.isArray(data.images) ? data.images : [];

        body.innerHTML = `
        <div class="page-meta">${pageMetaHtml(page)}</div>
        <h1 class="page-title" tabindex="-1">${escapeHtml(page.title)}</h1>
        ${typeof data.description === 'string' ? `<p class="muted">${escapeHtml(data.description)}</p>` : ''}
        ${frontmatter.error ? `<div class="banner"><span>The app cannot read the front matter of this page. ${escapeHtml(frontmatter.error)}</span><span>The text below shows the page as it is on GitHub.</span></div>` : ''}
        <section class="card" aria-labelledby="fields-title">
            <h2 class="card-title" id="fields-title">Front matter</h2>
            ${frontmatter.error
                ? `<pre class="page-text">${escapeHtml(frontmatter.raw)}</pre>`
                : `<dl class="fields">
                    <dt>File</dt><dd>${escapeHtml(path)}</dd>
                    ${fields.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(valueText(value))}</dd>`).join('')}
                </dl>`}
        </section>
        ${images.length ? `<section class="card" aria-labelledby="images-title">
            <h2 class="card-title" id="images-title">Images (${images.length})</h2>
            <ol class="image-list">
                ${images.map(image => `<li><span>${escapeHtml(image?.caption ?? image?.alt ?? '(no caption)')}</span><span class="muted small">${escapeHtml(image?.path ?? '(no path)')}</span></li>`).join('')}
            </ol>
        </section>` : ''}
        <section class="card" aria-labelledby="text-title">
            <h2 class="card-title" id="text-title">Text</h2>
            ${frontmatter.body.trim() ? `<pre class="page-text">${escapeHtml(frontmatter.body.trim())}</pre>` : '<p class="muted">This page has no text.</p>'}
        </section>
        <a class="text-link text-link--small" href="${githubFileUrl(site, path)}" target="_blank" rel="noopener noreferrer">Open the file on GitHub ${icon('external', 14)}</a>
        ${hasLocalEdit ? '<p class="banner">This page has changes on this device that are not published. Tap Edit to see them.</p>' : ''}
        <a class="btn btn-primary" href="#/site/${encodeURIComponent(site.id)}/edit/${encodeURIComponent(path)}">${icon('edit')} Edit</a>
        <button type="button" class="btn btn-danger" id="open-delete-page" aria-haspopup="dialog">Delete page</button>

        <dialog class="sheet" id="delete-page" aria-labelledby="delete-page-title">
            <div class="sheet-body">
                <h2 class="sheet-title" id="delete-page-title">Delete ${escapeHtml(page.title)}?</h2>
                <p>The app deletes this page from the repository on GitHub. The site removes the page after the next deploy, in a few minutes.</p>
                <p>Images that the page uses stay in the repository.</p>
                ${hasLocalEdit ? '<p class="banner">The changes on this device that are not published are deleted too.</p>' : ''}
                <p class="muted small" id="delete-status" aria-live="polite"></p>
                <p class="message-error" id="delete-error" role="alert"></p>
                <button type="button" class="btn btn-danger" id="confirm-delete-page">Delete page</button>
                <button type="button" class="btn btn-secondary" data-close>Cancel</button>
            </div>
        </dialog>`;
        body.querySelector('h1').focus({ preventScroll: true });
        bindDelete({ container, site, path, entry, slug: page.slug, token, siteHref });
    } catch (err) {
        if (controller.signal.aborted) return;
        const status = container.querySelector('#page-status');
        status.className = 'banner';
        status.textContent = err.message || 'The app cannot open this page.';
    }

    return () => controller.abort();
}
