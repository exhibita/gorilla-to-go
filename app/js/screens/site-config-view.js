// The Site details part of the site sheet: siteUrl, siteTitle and siteDescription of config.json (decision 39).
// state: { loading: true } | { offline: true } | { error } | { config, warning }.
import { escapeHtml } from '../dom.js';

export function siteConfigHtml(state) {
    const config = state.config ?? {};
    const disabled = state.config ? '' : ' disabled';
    const value = key => escapeHtml(typeof config[key] === 'string' ? config[key] : '');
    let status = '';
    if (state.loading) status = '<p class="muted small"><span class="spinner spinner--small" aria-hidden="true"></span> Reading config.json</p>';
    else if (state.offline) status = '<p class="muted small">Not read: no connection to GitHub</p>';
    else if (state.error) status = `<p class="message-error">${escapeHtml(state.error)}</p>`;

    return `<section class="site-config" aria-labelledby="site-config-title">
        <h3 class="card-title" id="site-config-title">Site details</h3>
        <p class="field-hint">The RSS feed and the sitemap use these values.</p>
        ${status}
        <p class="banner" data-address-warning${state.warning ? '' : ' hidden'}>This site uses the template's address, so its RSS feed and sitemap link to the wrong site. Type the address of your site and tap Save.</p>
        <div class="field">
            <label for="site-url">Site address</label>
            <input class="input" id="site-url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://" aria-describedby="site-url-error" value="${value('siteUrl')}"${disabled}>
            <div class="field-hint field-hint--error" id="site-url-error" hidden></div>
        </div>
        <div class="field">
            <label for="site-title">Site title</label>
            <input class="input" id="site-title" type="text" autocomplete="off" aria-describedby="site-title-error" value="${value('siteTitle')}"${disabled}>
            <div class="field-hint field-hint--error" id="site-title-error" hidden></div>
        </div>
        <div class="field">
            <label for="site-description">Description</label>
            <input class="input" id="site-description" type="text" autocomplete="off" value="${value('siteDescription')}"${disabled}>
        </div>
        <p class="message-error" id="config-error" role="alert"></p>
        <p class="muted small" id="config-saved" aria-live="polite"></p>
        <button type="button" class="btn btn-primary" id="save-config"${disabled}>Save</button>
    </section>`;
}
