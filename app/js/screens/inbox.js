// The Inbox screen (iPhone path): the photos that wait on the "gtg-inbox" branch (spec section 8.3).
// Discard deletes a photo from the inbox. "Add to a gallery" hands the photos to the gallery editor.
// The photos leave the inbox only after the user publishes the gallery.
import { getToken } from '../auth.js';
import { getSite } from '../sites.js';
import { loadPages } from '../pages.js';
import { listSiteEdits } from '../edits.js';
import { listWaiting, markPending, discard } from '../inbox.js';
import { setIncoming } from '../incoming.js';
import { escapeHtml, icon } from '../dom.js';
import { navigate } from '../router.js';
import { galleryPickerHtml } from './gallery-picker.js';
import { waitingCardHtml, mimeOf } from './inbox-view.js';

export async function inboxScreen(container, [id]) {
    const site = await getSite(id);
    if (!site) {
        navigate('#/', { replace: true });
        return;
    }
    const siteHref = `#/site/${encodeURIComponent(site.id)}`;
    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="${siteHref}" aria-label="Back to the pages">${icon('back', 22)}</a>
        <h1 tabindex="-1">Photo inbox</h1>
    </header>
    <div class="screen-body" id="inbox-body"></div>
    <div class="screen-footer" id="inbox-footer" hidden>
        <button type="button" class="btn btn-primary" id="add-to-gallery">Add to a gallery</button>
    </div>
    <dialog class="sheet" id="discard-sheet" aria-labelledby="discard-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="discard-title">Discard this photo?</h2>
            <p>The app deletes the photo from the inbox on GitHub. You cannot undo this.</p>
            <p class="message-error" id="discard-error" role="alert"></p>
            <button type="button" class="btn btn-danger" id="confirm-discard">Discard</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </div>
    </dialog>
    <dialog class="sheet" id="gallery-sheet" aria-labelledby="gallery-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="gallery-title">Add to a gallery</h2>
            <div id="gallery-list"></div>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </div>
    </dialog>
</div>`;

    const $ = selector => container.querySelector(selector);
    const body = $('#inbox-body');
    const controller = new AbortController();
    const closed = () => controller.signal.aborted;
    let items = [];
    let token = null;
    let discarding = null;

    for (const dialog of container.querySelectorAll('dialog')) {
        dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close(); // A tap on the dark area outside the sheet.
        });
    }

    const render = () => {
        $('#inbox-footer').hidden = items.every(item => item.pending);
        if (items.length === 0) {
            body.innerHTML = '<p class="empty">No photos are waiting.</p>';
            return;
        }
        body.innerHTML = `<ul class="photo-grid">${items.map(waitingCardHtml).join('')}</ul>
<a class="text-link text-link--small" href="#/help/shortcut">About photo privacy</a>`;
        for (const button of body.querySelectorAll('[data-discard]')) {
            button.addEventListener('click', () => {
                discarding = items.find(item => item.path === button.dataset.path && item.sha === button.dataset.sha);
                $('#discard-error').textContent = '';
                $('#discard-sheet').showModal();
            });
        }
    };

    const load = async () => {
        body.innerHTML = '<p class="muted" role="status"><span class="spinner"></span> Loading photos</p>';
        try {
            token = await getToken(site.id);
            if (!token) throw new Error('No token on this device. Remove the site and add it again.');
            const waiting = await listWaiting({ site, token });
            const edits = await listSiteEdits(site.id);
            if (closed()) return;
            items = markPending(waiting, edits);
            render();
        } catch (err) {
            if (closed()) return;
            $('#inbox-footer').hidden = true;
            body.innerHTML = `<div class="banner" role="alert">${escapeHtml(err.message)}</div>
<button type="button" class="btn btn-secondary" id="retry">Try again</button>`;
            $('#retry').addEventListener('click', load);
        }
    };

    $('#confirm-discard').addEventListener('click', async () => {
        const item = discarding;
        if (!item) return;
        const button = $('#confirm-discard');
        button.disabled = true;
        try {
            await discard({ item, site, token });
            items = items.filter(other => other !== item);
            $('#discard-sheet').close();
            render();
        } catch {
            $('#discard-error').textContent = 'The app cannot discard the photo. Check the connection and try again.';
        } finally {
            button.disabled = false;
        }
    });

    $('#add-to-gallery').addEventListener('click', async () => {
        const list = $('#gallery-list');
        list.innerHTML = '<p class="muted" role="status"><span class="spinner"></span> Loading galleries</p>';
        $('#gallery-sheet').showModal();
        try {
            const { pages } = await loadPages({ site, token });
            if (closed()) return;
            list.innerHTML = galleryPickerHtml(pages, site.id);
            for (const row of list.querySelectorAll('button[data-path]')) {
                row.addEventListener('click', () => {
                    const { path } = row.dataset;
                    const chosen = items.filter(item => !item.pending);
                    setIncoming({
                        siteId: site.id,
                        path,
                        files: chosen.map(item => new File([item.bytes], item.name, { type: mimeOf(item.name) })),
                        origins: chosen.map(({ path: inboxPath, sha }) => ({ path: inboxPath, sha }))
                    });
                    $('#gallery-sheet').close();
                    navigate(`${siteHref}/edit/${encodeURIComponent(path)}`);
                });
            }
        } catch (err) {
            if (!closed()) list.innerHTML = `<div class="banner" role="alert">${escapeHtml(err.message)}</div>`;
        }
    });

    load();
    return () => controller.abort();
}
