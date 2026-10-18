// Welcome screen: shown until the user adds the first site (decision 13).
import { VERSION } from '../version.js';
import { icon } from '../dom.js';
import { themeToggleHtml, bindThemeToggles } from '../theme.js';

export function welcomeScreen(container) {
    container.innerHTML = `
<div class="screen">
    <div class="header-row header-row--end">${themeToggleHtml()}</div>
    <div class="screen-body">
        <div class="welcome-hero">
            <img src="./img/logo.png" alt="Vanilla Gorilla logo" width="125" height="160">
            <h1 tabindex="-1">Gorilla To Go</h1>
            <p>Manage your sites from your phone.</p>
            <span class="chip">Version ${VERSION}</span>
        </div>
        <div class="welcome-actions">
            <section class="card" aria-labelledby="welcome-need">
                <h2 class="card-title" id="welcome-need">To start, you need:</h2>
                <ol class="steps">
                    <li><span class="step-num" aria-hidden="true">1</span><span>A Vanilla Gorilla site in a GitHub repository</span></li>
                    <li><span class="step-num" aria-hidden="true">2</span><span>A GitHub personal access token for that repository</span></li>
                </ol>
            </section>
            <a class="btn btn-primary" href="#/add">${icon('plus', 20, 2.2)} Add a site</a>
            <a class="text-link" href="#/help/token">How to create a GitHub token</a>
            <p class="note">${icon('lock', 14)} Your token stays on this device.</p>
        </div>
    </div>
</div>`;
    bindThemeToggles(container);
}
