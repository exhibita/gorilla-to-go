// New page (mvp-plan section 6, screen 4): type, title, address (slug) and description.
// Continue keeps the new page on this device and opens the editor. Nothing is on GitHub until Publish,
// so an empty page never goes live (each commit to main deploys the site).
import { getToken } from '../auth.js';
import { getSite } from '../sites.js';
import { deviceStore } from '../pages.js';
import { listNewPages, saveLocalEdit } from '../edits.js';
import { pathExists } from '../github.js';
import { NEW_PAGE_TYPES, slugify, slugProblem, pagePath, localDate, newPageText } from '../new-page.js';
import { icon } from '../dom.js';
import { back, navigate } from '../router.js';

const TYPE_ADDRESS = 'Type an address. Use small letters (a to z), digits and dashes.';

const addressText = (type, slug) => pagePath(type, slug || '…').replace(/^src/, '').replace(/index\.md$/, '');

export async function newPageScreen(container, [siteId]) {
    const site = await getSite(siteId);
    if (!site) {
        navigate('#/', { replace: true });
        return;
    }
    const siteHref = `#/site/${encodeURIComponent(site.id)}`;
    const list = await deviceStore.getPageList(site.id).catch(() => null);
    const newPages = await listNewPages(site.id).catch(() => []);
    const existingPaths = [...(list?.pages ?? []).map(page => page.path), ...newPages.map(edit => edit.path)];

    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="${siteHref}" data-back aria-label="Back to the pages">${icon('back', 22)}</a>
        <h1 tabindex="-1">New page</h1>
    </header>
    <form class="screen-body" id="new-form" novalidate>
        <fieldset class="field type-choice">
            <legend>Type</legend>
            <div class="type-options">
                ${NEW_PAGE_TYPES.map((t, i) => `<label class="type-option">
                    <input type="radio" name="type" value="${t.type}"${i === 0 ? ' checked' : ''}>
                    <span>${t.label}</span>
                </label>`).join('')}
            </div>
        </fieldset>
        <div class="field">
            <label for="new-title">Title</label>
            <input class="input" id="new-title" type="text" autocomplete="off" required>
        </div>
        <div class="field">
            <label for="new-slug">Address</label>
            <input class="input" id="new-slug" type="text" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="slug-hint">
            <div class="field-hint" id="slug-hint"></div>
        </div>
        <div class="field">
            <label for="new-description">Description</label>
            <textarea class="input input-multiline" id="new-description" rows="3"></textarea>
            <div class="field-hint">Optional. For search engines and the RSS feed.</div>
        </div>
        <div class="message-error" id="new-error" role="alert"></div>
    </form>
    <div class="screen-footer">
        <button type="submit" form="new-form" class="btn btn-primary" id="continue">Continue</button>
    </div>
</div>`;

    const $ = selector => container.querySelector(selector);
    const titleInput = $('#new-title');
    const slugInput = $('#new-slug');
    const hint = $('#slug-hint');
    const errorBox = $('#new-error');
    const type = () => container.querySelector('input[name="type"]:checked').value;

    // The address follows the title until the user changes the address.
    let slugEdited = false;

    const showAddress = () => {
        const slug = slugInput.value.trim();
        const problem = slug ? slugProblem(slug, { type: type(), existingPaths }) : null;
        // A title in another alphabet (for example Cyrillic) gives no address: ask for one.
        const needsAddress = !slug && titleInput.value.trim() !== '';
        hint.textContent = problem ?? (needsAddress
            ? TYPE_ADDRESS
            : `Address on the site: ${addressText(type(), slug)}. You cannot change the address after you publish.`);
        hint.classList.toggle('field-hint--error', Boolean(problem));
        slugInput.setAttribute('aria-invalid', String(Boolean(problem)));
    };

    titleInput.addEventListener('input', () => {
        if (!slugEdited) slugInput.value = slugify(titleInput.value);
        showAddress();
    });
    slugInput.addEventListener('input', () => {
        slugEdited = slugInput.value.trim() !== '';
        showAddress();
    });
    for (const radio of container.querySelectorAll('input[name="type"]')) radio.addEventListener('change', showAddress);
    showAddress();

    container.querySelector('[data-back]').addEventListener('click', event => {
        event.preventDefault();
        back(siteHref);
    });

    $('#new-form').addEventListener('submit', async event => {
        event.preventDefault();
        errorBox.textContent = '';
        const title = titleInput.value.trim();
        const slug = slugInput.value.trim();
        if (!title) {
            errorBox.textContent = 'Type a title.';
            titleInput.focus();
            return;
        }
        const problem = slugProblem(slug, { type: type(), existingPaths });
        if (problem) {
            errorBox.textContent = slug ? problem : TYPE_ADDRESS;
            slugInput.focus();
            return;
        }

        const path = pagePath(type(), slug);
        const button = $('#continue');
        button.disabled = true;
        try {
            // The saved list can be old: ask GitHub too. With no connection, Publish checks later
            // (GitHub refuses to create a file that exists).
            const token = await getToken(site.id);
            const folder = path.slice(0, -'/index.md'.length);
            if (await pathExists({ owner: site.owner, repo: site.repo, branch: site.branch, path: folder, token })) {
                errorBox.textContent = 'A page with this address exists on GitHub. Use a different address.';
                slugInput.focus();
                return;
            }
        } catch (err) {
            if (!err.offline) {
                errorBox.textContent = `The app cannot check the address: ${err.message}`;
                return;
            }
        } finally {
            button.disabled = false;
        }

        const text = newPageText({ title, date: localDate(), description: $('#new-description').value.trim(), type: type() });
        try {
            await saveLocalEdit({ siteId: site.id, path, baseSha: null, text });
        } catch {
            errorBox.textContent = 'The app cannot keep the new page on this device. Try again.';
            return;
        }
        navigate(`#/site/${encodeURIComponent(site.id)}/edit/${encodeURIComponent(path)}`, { replace: true });
    });
}

