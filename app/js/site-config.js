// The site keys of config.json: siteUrl, siteTitle and siteDescription (issue #38, decision 39).
// The RSS feed and the sitemap use them. GTG changes only these three keys and keeps all other keys
// (for example distributionId and awsProfile for invalidate.js) and their order.

export const TEMPLATE_SITE_URL = 'https://exhibita.github.io/vanilla-gorilla';
const TEMPLATE_REPOSITORY = 'exhibita/vanilla-gorilla';
const COMMENT = 'WARNING: Do NOT put secrets (passwords, API keys, tokens, access keys) in this file. It is committed to the GitHub repository.';

// text is null when the site has no config.json. Returns { ok: true, config } or { ok: false, error }.
// GTG never saves over a file that it cannot read, so a hand edit with an error is not lost.
export function parseSiteConfig(text) {
    if (text === null) return { ok: true, config: {} };
    try {
        const config = JSON.parse(text);
        if (config && typeof config === 'object' && !Array.isArray(config)) return { ok: true, config };
    } catch {
        // Not JSON.
    }
    return { ok: false, error: 'config.json is not valid JSON. Correct it on GitHub first.' };
}

// Trim the values and remove a "/" at the end of the address. The address must be a full http(s) URL:
// GTG does not add https:// (as for links, decision 30). The description can be empty.
export function checkSiteValues({ siteUrl = '', siteTitle = '', siteDescription = '' }) {
    const values = {
        siteUrl: String(siteUrl).trim().replace(/\/+$/, ''),
        siteTitle: String(siteTitle).trim(),
        siteDescription: String(siteDescription).trim()
    };
    const errors = {};
    let url = null;
    try {
        url = new URL(values.siteUrl);
    } catch {
        // Not a full URL.
    }
    if (!url || !['http:', 'https:'].includes(url.protocol) || !/^https?:\/\//i.test(values.siteUrl)) {
        errors.siteUrl = 'Type the full address, with https:// at the start.';
    }
    if (!values.siteTitle) errors.siteTitle = 'Type a title.';
    return { values, errors };
}

// The new text of config.json. text is the file now, or null when there is no file.
// Keeps the indentation of the file and its newline at the end, so the commit changes only the edited lines.
export function applySiteConfig(text, { siteUrl, siteTitle, siteDescription }) {
    const config = text === null ? { _comment: COMMENT } : JSON.parse(text);
    Object.assign(config, { siteUrl, siteTitle, siteDescription });
    const indent = text === null ? '  ' : (text.match(/\n([ \t]+)"/)?.[1] ?? '  ');
    const newline = text === null || text.endsWith('\n') ? '\n' : '';
    return JSON.stringify(config, null, indent) + newline;
}

// True when the RSS feed and the sitemap use the template's address: no siteUrl (the build then uses
// the template's address) or the template's address itself. The template repository can use it.
export function needsAddressWarning(config, { owner, repo }) {
    if (`${owner}/${repo}`.toLowerCase() === TEMPLATE_REPOSITORY) return false;
    const url = typeof config.siteUrl === 'string' ? config.siteUrl.trim().replace(/\/+$/, '') : '';
    return !url || url === TEMPLATE_SITE_URL;
}
