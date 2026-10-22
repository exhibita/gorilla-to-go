// Rules for the links: list of a links page (template version 3), as build.js linkItems reads it,
// without network, DOM or storage, so they run in tests.

// The only link protocols that the build accepts (build.js ALLOWED_LINK_PROTOCOLS).
export const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:']);

// The template version that adds links pages. An older build skips a links page.
export const LINKS_TEMPLATE_VERSION = 3;

// The reason why the build would skip this link, or null. The address must be a full URL with a
// protocol: the app does not add https:// (decision 30).
export function linkProblem(link) {
    const text = link?.text == null ? '' : String(link.text).trim();
    const url = typeof link?.url === 'string' ? link.url.trim() : '';
    if (!text) return 'Type the text of the button.';
    if (!url) return 'Type the address of the link.';
    let protocol;
    try {
        protocol = new URL(url).protocol;
    } catch {
        return 'Type the full address, with https:// at the start.';
    }
    if (!ALLOWED_LINK_PROTOCOLS.has(protocol)) return 'The site does not accept this kind of address. Use a web address, or a mailto:, tel: or sms: address.';
    return null;
}

// A copy of the links: list of the front matter. An empty list when there is no list.
export function linkItems(data) {
    return Array.isArray(data?.links) ? structuredClone(data.links) : [];
}
