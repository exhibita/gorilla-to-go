// About Gorilla To Go: name, version, purpose, license, source and help. A bottom sheet, so any
// screen can show it (now the Pages list; the Welcome screen shows the version itself).
import { VERSION } from '../version.js';
import { icon } from '../dom.js';

export function aboutSheetHtml() {
    return `
    <dialog class="sheet" id="about" aria-labelledby="about-title">
        <div class="sheet-body about">
            <img class="about-logo" src="./img/logo.png" alt="" width="63" height="80">
            <h2 class="sheet-title" id="about-title">About Gorilla To Go</h2>
            <span class="chip">Version ${VERSION}</span>
            <p>Gorilla To Go lets you manage your Vanilla Gorilla sites from your phone. You can add, edit and delete pages.</p>
            <p>The app does not build the site. It commits Markdown files to the GitHub repository of the site. Then the GitHub Actions workflow of the site builds and deploys the site.</p>
            <p class="muted small">License: AGPL-3.0-or-later. Your token stays on this device.</p>
            <ul class="about-links">
                <li><a class="text-link text-link--small" href="https://github.com/exhibita/gorilla-to-go" target="_blank" rel="noopener noreferrer">Source code on GitHub ${icon('external', 14)}</a></li>
                <li><a class="text-link text-link--small" href="#/help/token" data-about-link>How to create a GitHub token</a></li>
                <li><a class="text-link text-link--small" href="#/help/upgrade" data-about-link>How to upgrade a site</a></li>
            </ul>
            <button type="button" class="btn btn-secondary" data-close>Close</button>
        </div>
    </dialog>`;
}

// Connect the sheet to a button. root contains both the button and the sheet.
export function bindAbout(root, button) {
    const dialog = root.querySelector('#about');
    button.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close(); // A tap on the dark area outside the sheet.
    });
    // A help link opens another screen: close the sheet first.
    for (const link of dialog.querySelectorAll('[data-about-link]')) link.addEventListener('click', () => dialog.close());
}
