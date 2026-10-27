// The HTML builders of the Inbox screen and the "photos waiting" row of the site screen.
import { escapeHtml, icon } from '../dom.js';
import { bytesToBase64 } from '../github.js';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

export const mimeOf = name => MIME[/\.([^.]+)$/.exec(name)?.[1].toLowerCase()] ?? 'image/jpeg';

// The CSP allows data: images and does not allow blob: images.
export const thumbnailUrl = item => `data:${mimeOf(item.name)};base64,${bytesToBase64(item.bytes)}`;

// item: { name, path, sha, bytes, pending? }.
export function waitingCardHtml(item) {
    return `<li class="photo-card photo-card--waiting">
    <span class="photo-frame"><img src="${thumbnailUrl(item)}" alt=""></span>
    <span class="photo-label">${escapeHtml(item.name)}</span>
    <span class="photo-marks">${item.pending ? '<span class="photo-mark">Added, not published</span>' : ''}</span>
    <button type="button" class="btn-small photo-discard" data-discard data-path="${escapeHtml(item.path)}" data-sha="${escapeHtml(item.sha)}">Discard</button>
</li>`;
}

// The row on the site screen. Empty when no photo waits, or when the app cannot tell (null).
export function waitingRowHtml(count, siteId) {
    if (!count) return '';
    return `<a class="page-card" href="#/site/${encodeURIComponent(siteId)}/inbox">
    <span class="page-card-text"><span class="page-card-title">${count} ${count === 1 ? 'photo' : 'photos'} waiting</span></span>${icon('chevronRight', 18)}</a>`;
}
