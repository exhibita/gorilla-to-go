// The Links view of the editor for a links page (template version 3): the picture above the title,
// the list of link buttons, the sheet for one link, and the buttons in the Preview. The editor keeps
// the state (the links: list and the front matter fields); this module makes the parts of the screen.
import { linkProblem } from '../links.js';
import { icon } from '../dom.js';

export const isLink = item => item !== null && typeof item === 'object' && !Array.isArray(item);
const textOf = value => (value == null ? '' : String(value));

export const linksViewHtml = () => `<div class="links-view" id="links-view" hidden>
    <section class="links-picture" aria-labelledby="picture-title">
        <h2 class="card-title" id="picture-title">Picture</h2>
        <div class="links-picture-row">
            <span class="photo-frame links-picture-frame" id="picture-frame"></span>
            <div class="links-picture-actions">
                <p class="muted small" id="picture-info"></p>
                <button type="button" class="btn-small" id="picture-change">${icon('image', 16)} <span id="picture-change-text">Add picture</span></button>
                <button type="button" class="btn-small" id="picture-remove">Remove picture</button>
            </div>
        </div>
        <div class="field" id="picture-alt-field">
            <label for="picture-alt">Alt text</label>
            <input class="input" id="picture-alt" type="text">
            <div class="field-hint">Describe the picture for people who cannot see it.</div>
        </div>
        <input type="file" id="picture-file" accept="image/*" hidden>
    </section>
    <section aria-labelledby="links-title">
        <h2 class="card-title" id="links-title">Links</h2>
        <p class="muted small" id="links-hint"></p>
        <ol class="link-list" id="link-list"></ol>
        <button type="button" class="btn btn-secondary" id="add-link">${icon('plus', 18)} Add link</button>
    </section>
</div>`;

export const linkSheetHtml = () => `<dialog class="sheet" id="link-sheet" aria-labelledby="link-sheet-title">
    <form class="sheet-body" id="link-form" novalidate>
        <h2 class="sheet-title" id="link-sheet-title" aria-live="polite"></h2>
        <p class="muted small" id="link-note" hidden></p>
        <div class="field">
            <label for="link-text">Button text</label>
            <input class="input" id="link-text" type="text">
        </div>
        <div class="field">
            <label for="link-url">Address</label>
            <input class="input" id="link-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="link-url-hint">
            <div class="field-hint" id="link-url-hint">The full address, with https:// at the start. For an email, a phone call or a text message, start with mailto:, tel: or sms:.</div>
        </div>
        <p class="message-error" id="link-error" role="alert"></p>
        <div class="sheet-row" id="link-move">
            <button type="button" class="btn btn-secondary" id="link-earlier">Move earlier</button>
            <button type="button" class="btn btn-secondary" id="link-later">Move later</button>
        </div>
        <button type="submit" class="btn btn-primary" id="link-apply">Apply</button>
        <button type="button" class="btn btn-secondary" id="link-remove">Remove link</button>
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
    </form>
</dialog>`;

// One button per link, with the button text, the address and a mark when the site skips the link.
export function linkListItems(links, onOpen) {
    return links.map((item, index) => {
        const editable = isLink(item);
        const label = editable ? textOf(item.text).trim() || '(no text)' : String(item);
        const problem = editable ? linkProblem(item) : 'This item is not a link.';
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'link-row';
        button.setAttribute('aria-haspopup', 'dialog');
        button.addEventListener('click', () => onOpen(index));
        const text = document.createElement('span');
        text.className = 'link-row-text';
        text.textContent = label;
        const url = document.createElement('span');
        url.className = 'link-row-url';
        url.textContent = editable ? textOf(item.url) || '(no address)' : '';
        button.append(text, url);
        if (problem) {
            const mark = document.createElement('span');
            mark.className = 'photo-mark photo-mark--warn';
            mark.textContent = 'The site skips this link';
            button.append(mark);
        }
        button.setAttribute('aria-label', `Link ${index + 1}: ${label}${problem ? ` (the site skips this link: ${problem})` : ''}`);
        li.append(button);
        return li;
    });
}

// The link buttons in the Preview, after the text, as on the site. They do not open the address.
export function previewLinks(links) {
    const list = document.createElement('div');
    list.className = 'preview-links';
    for (const item of links) {
        if (!isLink(item) || linkProblem(item)) continue; // The build skips it.
        const button = document.createElement('span');
        button.className = 'preview-link-button';
        button.textContent = textOf(item.text).trim();
        button.title = item.url.trim();
        list.append(button);
    }
    return list;
}

// The first link that the site would skip, as a message for Publish, or null.
export function firstLinkProblem(links) {
    for (const [index, item] of links.entries()) {
        const problem = isLink(item) ? linkProblem(item) : 'This item is not a link.';
        if (problem) return `Link ${index + 1} (${isLink(item) ? textOf(item.text).trim() || 'no text' : String(item)}): ${problem}`;
    }
    return null;
}
