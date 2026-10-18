// Rules for the page list, without network or storage, so they run in tests.
import { isDraft } from './frontmatter.js';

export const TYPE_LABELS = { blog: 'Blog', page: 'Page', gallery: 'Gallery' };

// The type and slug of a Markdown file, from its path (as build.js does). null when the file is not a page.
// src/blog/<slug>/index.md → blog, src/gallery/<slug>/index.md → gallery, every other src/**/*.md → page.
// The "skeleton" field does not change the type.
export function classifyPath(path) {
    const match = String(path).match(/^src\/(.+)\.md$/);
    if (!match) return null;
    const parts = match[1].split('/');
    if (parts[0] === 'templates' || parts[0] === 'skeletons') return null;
    const isIndex = parts.at(-1) === 'index';
    const slugParts = isIndex ? parts.slice(0, -1) : parts;
    if (slugParts.length === 0) return { type: 'page', slug: 'index' };
    if (isIndex && parts.length === 3 && parts[0] === 'blog' && parts[1] !== 'author') return { type: 'blog', slug: parts[1] };
    if (isIndex && parts.length === 3 && parts[0] === 'gallery') return { type: 'gallery', slug: parts[1] };
    return { type: 'page', slug: slugParts.join('/') };
}

// The list entry for one page, from its path, blob SHA and parsed front matter.
export function pageSummary(path, sha, { data, error }) {
    const { type, slug } = classifyPath(path);
    const title = typeof data.title === 'string' || typeof data.title === 'number' ? String(data.title).trim() : '';
    const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
    return {
        path,
        sha,
        type,
        slug,
        title: title || slug,
        date,
        draft: isDraft(data),
        imageCount: Array.isArray(data.images) ? data.images.length : 0,
        error
    };
}

// Newest first; pages without a date last, by title (as build.js sortedPosts).
export function sortPages(pages) {
    return [...pages].sort((a, b) => {
        if (!a.date && !b.date) return a.title.localeCompare(b.title);
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
    });
}

// type: 'all', 'blog', 'page' or 'gallery'. query: text to find in the title or the slug.
export function filterPages(pages, { type = 'all', query = '' } = {}) {
    const text = query.trim().toLowerCase();
    return pages.filter(page =>
        (type === 'all' || page.type === type) &&
        (!text || page.title.toLowerCase().includes(text) || page.slug.toLowerCase().includes(text)));
}

// "Oct 17, 2026". Dates are UTC midnight, so format in UTC (else US time zones show the day before).
export function formatDate(date) {
    if (!date) return '';
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
