// The gallery list of the Share screen and the Inbox screen. HTML builders only, so tests run without the screens' imports.
import { escapeHtml, icon } from '../dom.js';

export const galleries = pages => pages.filter(page => page.type === 'gallery');

export function shareIntroText(count) {
    if (count === 0) return 'No photos were received.';
    return `Add ${count} ${count === 1 ? 'photo' : 'photos'} to a gallery`;
}

// One 44 px row for each gallery. A gallery with a front matter error cannot take photos.
export function galleryPickerHtml(pages, siteId) {
    const list = galleries(pages);
    if (list.length === 0) {
        return `<p class="empty">This site has no gallery.</p>
<a class="btn btn-secondary" href="#/site/${encodeURIComponent(siteId)}/new">${icon('plus', 20, 2.2)} New page</a>`;
    }
    return `<ul class="page-list">${list.map(page => `<li><button type="button" class="pick-row" data-path="${escapeHtml(page.path)}"${page.error ? ' disabled' : ''}>
    <span class="page-card-text">
        <span class="page-meta"><span class="type-label type-label--gallery">Gallery</span>${page.error ? '<span class="error-label">Front matter error</span>' : ''}</span>
        <span class="page-card-title">${escapeHtml(page.title)}</span>
    </span>${icon('chevronRight', 18)}</button></li>`).join('')}</ul>`;
}
