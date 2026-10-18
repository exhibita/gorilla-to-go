// Rules for the images of a page (mvp-plan section 7, decision 21), without network, DOM or storage,
// so they run in tests.
import { classifyPath } from './pages-logic.js';
import { slugify } from './new-page.js';

// The app makes each photo at most this wide before the upload.
export const MAX_WIDTH = 1600;

const MAX_STEM_LENGTH = 40;

// The folder for the images of a page: src/images/<type>/<slug>/.
export function imageFolder(pagePath) {
    const { type, slug } = classifyPath(pagePath);
    return `src/images/${type}/${slug}/`;
}

// src/images/... → ./images/... (the path in the Markdown; build.js rewrites ./ for the page depth).
// Each part is encoded, so a folder with a space or a parenthesis (a hand-made page) still gives a
// Markdown image.
export function markdownPath(repoPath) {
    const encode = part => encodeURIComponent(part).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return `./${repoPath.slice('src/'.length).split('/').map(encode).join('/')}`;
}

// ./images/... in the page → src/images/..., or null for any other address.
export function repoImagePath(address) {
    let path;
    try {
        path = decodeURI(String(address ?? ''));
    } catch {
        return null;
    }
    if (!path.startsWith('./images/')) return null;
    const rest = path.slice(2);
    if (rest.split('/').some(part => part === '' || part === '.' || part === '..')) return null;
    return `src/${rest}`;
}

// A file name from the name of the photo, with the extension of the new copy. -2, -3 when the name is
// taken. Letter case does not matter, because some computers do not see a difference.
export function imageName(fileName, extension, takenNames) {
    let stem = slugify(String(fileName ?? '').replace(/\.[^.]*$/, '')).slice(0, MAX_STEM_LENGTH).replace(/-+$/, '');
    if (!stem) stem = 'image';
    const taken = new Set(takenNames.map(name => name.toLowerCase()));
    let name = `${stem}.${extension}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem}-${n}.${extension}`;
    return name;
}

// The file names that the text uses in the folder, for example ['cat.jpg'] for ./images/blog/p/cat.jpg.
export function namesInText(text, folder) {
    const prefix = markdownPath(folder);
    const names = [];
    let at = text.indexOf(prefix);
    while (at !== -1) {
        const name = text.slice(at + prefix.length).match(/^[^\s/)"'<>\]]+/)?.[0];
        if (name) names.push(name);
        at = text.indexOf(prefix, at + prefix.length);
    }
    return names;
}

// The size of the copy: at most MAX_WIDTH wide, with the same aspect ratio. Never larger.
export function fitSize(width, height, max = MAX_WIDTH) {
    if (width <= max) return { width, height };
    return { width: max, height: Math.max(1, Math.round(height * max / width)) };
}

// ![alt](path). The alt text is on one line, and \ [ ] are escaped.
export function markdownImage(alt, path) {
    const text = String(alt ?? '').replace(/\s+/g, ' ').trim().replace(/[\\[\]]/g, '\\$&');
    return `![${text}](${path})`;
}

// A copy of the gallery images: list of the front matter. An empty list when there is no list.
export function galleryItems(data) {
    return Array.isArray(data?.images) ? structuredClone(data.images) : [];
}

// The repository file of a gallery image path, as the build reads it (it adds ./ to a path without
// it), or null for an address that is not a file of the site.
export function galleryImagePath(path) {
    if (typeof path !== 'string') return null;
    const value = path.trim();
    if (/^[a-z][a-z0-9+.-]*:|^\/|^\.\.\//i.test(value)) return null;
    return repoImagePath(value.startsWith('./') ? value : `./${value}`);
}

// A copy of the list with one item moved. A place outside the list changes nothing.
export function moveItem(list, from, to) {
    const copy = [...list];
    if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
    copy.splice(to, 0, ...copy.splice(from, 1));
    return copy;
}

// Put a block (for example an image line) at the cursor, as its own paragraph: blank lines before
// and after it when needed. A selection is replaced. The cursor goes after the block.
export function insertBlock({ text, start, end }, block) {
    const before = text.slice(0, start);
    const after = text.slice(end);
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const inserted = `${lead}${block}${trail}`;
    const cursor = before.length + lead.length + block.length + (after === '' ? trail.length : 0);
    return { text: before + inserted + after, start: cursor, end: cursor };
}

// The places where the text uses this ./images/ path: not a longer name that starts with it, and not
// a path that ends with it (for example ../images/...).
function pathPositions(text, path) {
    const positions = [];
    let at = text.indexOf(path);
    while (at !== -1) {
        const before = at === 0 ? '' : text[at - 1];
        const after = text.slice(at + path.length, at + path.length + 1);
        if (!/^[\w./%-]/.test(before) && !/^[\w.-]/.test(after)) positions.push(at);
        at = text.indexOf(path, at + 1);
    }
    return positions;
}

// The images whose ./images/ path the text still uses. A deleted image line is not uploaded.
export function referencedImages(text, images) {
    return images.filter(image => pathPositions(text, markdownPath(image.path)).length > 0);
}

// The text with each use of the from path changed to the to path.
export function replaceImagePath(text, from, to) {
    let result = text;
    for (const at of pathPositions(text, from).reverse()) result = result.slice(0, at) + to + result.slice(at + from.length);
    return result;
}
