// Page view: one page for reading (build step 3). It shows the front matter and the Markdown text.
// Editing comes in build step 4.
import { getToken } from '../auth.js';
import { getSite } from '../sites.js';
import { getPageText, deviceStore } from '../pages.js';
import { parseFrontmatter } from '../frontmatter.js';
import { classifyPath, pageSummary } from '../pages-logic.js';
import { escapeHtml, icon } from '../dom.js';
import { back, navigate } from '../router.js';
import { pageMetaHtml } from './site.js';

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
        <p class="muted small">Editing comes in the next version of the app.</p>`;
        body.querySelector('h1').focus({ preventScroll: true });
    } catch (err) {
        if (controller.signal.aborted) return;
        const status = container.querySelector('#page-status');
        status.className = 'banner';
        status.textContent = err.message || 'The app cannot open this page.';
    }

    return () => controller.abort();
}
