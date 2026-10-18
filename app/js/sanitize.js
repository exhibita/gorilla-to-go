// Make the Preview HTML safe. marked passes raw HTML in a page through as it is, and the page text
// comes from the repository, so only an allowlist of elements and attributes stays. The CSP is the
// second line of defense. DOMParser makes an inert document: nothing in it runs or loads.

const KEEP = new Set([
    'A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DD', 'DEL', 'DETAILS', 'DIV', 'DL', 'DT', 'EM',
    'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'INPUT', 'INS', 'KBD',
    'LI', 'MARK', 'OL', 'P', 'PRE', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUMMARY', 'SUP', 'TABLE',
    'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL'
]);

// These go away with all their content.
const DROP = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'TEMPLATE', 'NOSCRIPT',
    'SVG', 'MATH', 'FORM', 'TEXTAREA', 'SELECT', 'BUTTON', 'LINK', 'META', 'BASE', 'TITLE', 'AUDIO', 'VIDEO',
    'SOURCE', 'TRACK', 'CANVAS', 'DIALOG'
]);

const ATTRIBUTES = {
    A: ['href', 'title'],
    IMG: ['src', 'alt', 'title'],
    INPUT: ['type', 'checked'],
    OL: ['start'],
    TD: ['align', 'colspan', 'rowspan'],
    TH: ['align', 'colspan', 'rowspan'],
    CODE: ['class']
};

// Only links that open outside the app: http, https and mailto. Not javascript:, data: or other
// schemes. Anchors (#...) and relative addresses are not links in the Preview: in the app they
// would open another screen and close the editor.
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function clean(node, doc) {
    for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) {
            child.remove(); // Comments
            continue;
        }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName.toUpperCase();
        if (DROP.has(tag)) {
            child.remove();
            continue;
        }
        if (!KEEP.has(tag)) {
            clean(child, doc);
            child.replaceWith(...child.childNodes); // Keep the text, not the element.
            continue;
        }
        const allowed = ATTRIBUTES[tag] ?? [];
        for (const { name } of [...child.attributes]) {
            if (!allowed.includes(name.toLowerCase())) child.removeAttribute(name);
        }
        if (tag === 'A') {
            const href = child.getAttribute('href')?.trim() ?? '';
            if (!href || !SAFE_URL.test(href)) child.removeAttribute('href');
            else if (/^https?:/i.test(href)) {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }
        }
        // marked writes class="language-x" on code blocks. Other classes could use the app's own styles.
        if (tag === 'CODE' && !/^language-[\w-]+$/.test(child.getAttribute('class') ?? '')) child.removeAttribute('class');
        if (tag === 'INPUT') {
            if (child.getAttribute('type') !== 'checkbox') {
                child.remove();
                continue;
            }
            child.setAttribute('disabled', '');
        }
        if (tag === 'IMG') {
            // Images come with image upload (step 7). Show the alt text and the path, and load nothing.
            const note = doc.createElement('span');
            note.className = 'preview-image';
            note.textContent = `Image: ${child.getAttribute('alt') || '(no alt text)'} (${child.getAttribute('src') || 'no path'})`;
            child.replaceWith(note);
            continue;
        }
        clean(child, doc);
    }
}

// Returns the safe nodes as a DocumentFragment.
export function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
    clean(doc.body, doc);
    const fragment = document.createDocumentFragment();
    fragment.append(...[...doc.body.childNodes].map(node => document.adoptNode(node)));
    return fragment;
}
