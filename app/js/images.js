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
export function markdownPath(repoPath) {
    return `./${repoPath.slice('src/'.length)}`;
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

// The images whose ./images/ path the text still uses. A deleted image line is not uploaded.
export function referencedImages(text, images) {
    return images.filter(image => {
        const path = markdownPath(image.path);
        let at = text.indexOf(path);
        while (at !== -1) {
            if (!/^[\w.-]/.test(text.slice(at + path.length, at + path.length + 1))) return true;
            at = text.indexOf(path, at + 1);
        }
        return false;
    });
}
