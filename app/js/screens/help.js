// Help pages inside the app, so they work offline (decision 16).
// Token page: from docs/github-token.md. Upgrade page: from vanilla-gorilla docs/UPGRADE-v2.md.
// Install page: from docs/install-app.md (help-install.js).
import { icon } from '../dom.js';
import { back } from '../router.js';
import { REQUIRED_TEMPLATE_VERSION } from '../github.js';
import { INSTALL_PAGE } from './help-install.js';

const TOKEN_PAGE = `
<p>Gorilla To Go needs a token to change your site on GitHub. A token is like a password that works for one site only.</p>
<p>You need one token for each site.</p>

<h2>Before you start</h2>
<ul>
    <li>You need a GitHub account.</li>
    <li>Your Vanilla Gorilla site must be in a GitHub repository.</li>
    <li>Use a computer or a phone browser. The GitHub mobile app cannot make tokens.</li>
</ul>

<h2>Make the token</h2>
<ol>
    <li>Sign in to github.com.</li>
    <li>Tap your profile picture at the top right.</li>
    <li>Tap <strong>Settings</strong>.</li>
    <li>Scroll down and tap <strong>Developer settings</strong>.</li>
    <li>Tap <strong>Personal access tokens</strong>.</li>
    <li>Tap <strong>Fine-grained tokens</strong>.</li>
    <li>Tap <strong>Generate new token</strong>.</li>
    <li>In <strong>Token name</strong>, type a name, for example <code>Gorilla To Go – my-site</code>.</li>
    <li>In <strong>Expiration</strong>, select how long the token works. When it expires, you must make a new token.</li>
    <li>In <strong>Resource owner</strong>, select the account that owns the site.</li>
    <li>In <strong>Repository access</strong>, select <strong>Only select repositories</strong>.</li>
    <li>Select your site's repository.</li>
    <li>Under <strong>Permissions</strong>, open <strong>Repository permissions</strong>.</li>
    <li>Set <strong>Contents</strong> to <strong>Read and write</strong>.</li>
    <li>Set <strong>Actions</strong> to <strong>Read-only</strong>.</li>
    <li>Tap <strong>Generate token</strong>.</li>
    <li>Tap the copy button next to the token.</li>
</ol>
<p>GitHub shows the token only once. If you lose it, make a new token.</p>
<p><a class="text-link text-link--small" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Open the token page on GitHub ${icon('external', 14)}</a></p>

<h2>Add the token to Gorilla To Go</h2>
<ol>
    <li>Open Gorilla To Go.</li>
    <li>Tap <strong>Add a site</strong>.</li>
    <li>Tap <strong>Paste</strong> next to <strong>Personal access token</strong>.</li>
</ol>
<p>The app checks the token automatically.</p>

<h2>Keep your token safe</h2>
<ul>
    <li>Do not share the token.</li>
    <li>Do not put the token in an email, a message or a file.</li>
    <li>Gorilla To Go keeps the token on your device only.</li>
    <li>If you think someone has your token, delete it on GitHub at once. Then make a new token.</li>
</ul>

<h2>If something does not work</h2>
<ul>
    <li><strong>"Token not accepted":</strong> copy the token again, and make sure you copied all of it.</li>
    <li><strong>"Repository not found":</strong> make sure you selected the site's repository in step 12.</li>
    <li><strong>"No write access":</strong> make sure <strong>Contents</strong> is set to <strong>Read and write</strong> in step 14.</li>
    <li><strong>"No Actions access":</strong> make sure <strong>Actions</strong> is set to <strong>Read-only</strong> in step 15.</li>
    <li><strong>The site belongs to an organization:</strong> see the next section.</li>
</ul>

<h2>If the site belongs to an organization</h2>
<p>GitHub says "Repository not found" when the token cannot see the repository. For an organization, check these items:</p>
<ol>
    <li>You are a member of the organization, with write access to the repository. An outside collaborator cannot make a token for an organization.</li>
    <li>In step 10, <strong>Resource owner</strong> is the organization, not your own account. If the organization is not in the list, the organization does not allow fine-grained tokens. Ask an organization owner to allow them.</li>
    <li>The organization approved the token. An organization owner opens the organization's <strong>Settings</strong>, then <strong>Personal access tokens</strong>, then <strong>Pending requests</strong>, and approves the token.</li>
</ol>
<p>Organization owners set the rules in the organization's <strong>Settings</strong> &gt; <strong>Personal access tokens</strong> &gt; <strong>Settings</strong>: allow fine-grained tokens, and choose if each token needs approval.</p>
<p>Note: GitHub sometimes changes the names and places of these settings. If a step does not match, look for <strong>Fine-grained tokens</strong> in <strong>Developer settings</strong>.</p>`;

const UPGRADE_PAGE = `
<p>Gorilla To Go needs Vanilla Gorilla template version ${REQUIRED_TEMPLATE_VERSION}. Version ${REQUIRED_TEMPLATE_VERSION} adds drafts and galleries from a list of images.</p>
<p>Do the upgrade on a computer. Hand-built HTML pages and HTML galleries do not change.</p>

<h2>Upgrade a site</h2>
<ol>
    <li>Make a new branch in the site repository.</li>
    <li>Copy <code>build.js</code> from the template into the site.</li>
    <li>Copy <code>src/skeletons/gallery-skeleton.html</code> from the template into the site.</li>
    <li>In <code>package.json</code>, add these two fields:
        <pre><code>"license": "AGPL-3.0-or-later",
"vanillaGorilla": { "templateVersion": 2 }</code></pre>
    </li>
    <li>Run <code>npm install --package-lock-only</code>.</li>
    <li>Run <code>npm run build</code>.</li>
    <li>Make sure the build shows <code>Build complete.</code></li>
    <li>Open some pages from <code>dist/</code> and make sure they look correct.</li>
    <li>Merge the branch into <code>main</code>.</li>
    <li>Make sure the GitHub Actions deploy is successful.</li>
</ol>
<p>Then add the site in Gorilla To Go again.</p>
<p><a class="text-link text-link--small" href="https://github.com/exhibita/vanilla-gorilla/blob/main/docs/UPGRADE-v2.md" target="_blank" rel="noopener noreferrer">Read the full upgrade guide on GitHub ${icon('external', 14)}</a></p>`;

function helpScreen(container, title, body) {
    container.innerHTML = `
<div class="screen">
    <header class="topbar">
        <a class="icon-btn icon-btn--plain" href="#/" data-back aria-label="Back">${icon('back', 22)}</a>
        <h1 tabindex="-1">${title}</h1>
    </header>
    <div class="screen-body prose">${body}</div>
</div>`;
    container.querySelector('[data-back]').addEventListener('click', event => {
        event.preventDefault();
        back('#/');
    });
}

export const tokenHelpScreen = container => helpScreen(container, 'Create a GitHub token', TOKEN_PAGE);
export const upgradeHelpScreen = container => helpScreen(container, 'Upgrade a site', UPGRADE_PAGE);

export function installHelpScreen(container) {
    helpScreen(container, 'Install the app', INSTALL_PAGE);
    // A button with data-jump scrolls to its section, and the section gets the focus (for screen readers).
    for (const button of container.querySelectorAll('[data-jump]')) {
        button.addEventListener('click', () => {
            const section = container.querySelector(`#${CSS.escape(button.dataset.jump)}`);
            section?.scrollIntoView({ block: 'start' });
            section?.focus({ preventScroll: true });
        });
    }
}
