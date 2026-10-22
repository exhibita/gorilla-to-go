// Rules for a new page (mvp-plan section 5 "Add"), without network or storage, so they run in tests.
import { setFields, composePage } from './frontmatter-write.js';
import { LINKS_TEMPLATE_VERSION } from './links.js';

// minTemplate: the template version that the type needs. An older build skips the page.
export const NEW_PAGE_TYPES = [
    { type: 'blog', label: 'Blog post' },
    { type: 'page', label: 'Page' },
    { type: 'gallery', label: 'Gallery' },
    { type: 'links', label: 'Links page', minTemplate: LINKS_TEMPLATE_VERSION }
];

// The types that a site with this template version can build (decision 27).
export const newPageTypes = templateVersion => NEW_PAGE_TYPES.filter(t => !t.minTemplate || templateVersion >= t.minTemplate);

const MAX_SLUG_LENGTH = 60;

// Letters that NFD does not split into a letter and an accent.
const SPECIAL_LETTERS = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th' };

// "Recipe: Pasta & more!" → "recipe-pasta-more". An empty text when the title has no letters or digits.
export function slugify(title) {
    let slug = String(title ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '') // Accents
        .replace(/[ßæœøłđðþ]/g, letter => SPECIAL_LETTERS[letter])
        .replace(/['’]/g, '') // "it's" → "its"
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (slug.length > MAX_SLUG_LENGTH) {
        slug = slug.slice(0, MAX_SLUG_LENGTH);
        const lastDash = slug.lastIndexOf('-');
        if (lastDash > MAX_SLUG_LENGTH / 2) slug = slug.slice(0, lastDash); // Do not cut a word.
        slug = slug.replace(/-+$/, '');
    }
    return slug;
}

// The file of a new page (vanilla-gorilla-notes): blog and gallery have their folders. A links page
// is at the address of a page (decision 28).
export function pagePath(type, slug) {
    if (type === 'blog') return `src/blog/${slug}/index.md`;
    if (type === 'gallery') return `src/gallery/${slug}/index.md`;
    return `src/${slug}/index.md`;
}

// Addresses the site uses for other things. Pages: the folders of the site. Blog and gallery:
// "page" is used for the pages of the index (/blog/page/2/), and build.js does not treat
// blog/author as a blog post.
const RESERVED = {
    page: new Set(['blog', 'gallery', 'images', 'img', 'css', 'js', 'fonts', 'templates', 'skeletons', 'assets']),
    blog: new Set(['page', 'author']),
    gallery: new Set(['page'])
};
RESERVED.links = RESERVED.page;

// The reason why the address cannot be used, or null.
export function slugProblem(slug, { type, existingPaths = [] }) {
    if (!slug) return 'Type an address.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use only small letters (a to z), digits and single dashes.';
    if (RESERVED[type]?.has(slug)) return 'The site uses this address for its own files. Use a different address.';
    const folder = pagePath(type, slug).slice(0, -'index.md'.length);
    if (existingPaths.some(path => path.startsWith(folder))) return 'A page with this address exists. Use a different address.';
    return null;
}

// Today on the device, as YYYY-MM-DD (not the UTC date: a page made late in the evening keeps its day).
export function localDate(date = new Date()) {
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The text of a new page: title, date, description (when typed) and skeleton, then an empty body.
// A links page has no date: the links skeleton does not show one.
export function newPageText({ title, date, description, type }) {
    const raw = `${setFields('', { title, date: type === 'links' ? '' : date, description })}\nskeleton: ${type}`;
    return composePage({ hasFrontmatter: true, raw, body: '\n', eol: '\n' });
}
