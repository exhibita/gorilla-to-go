// The "Install the app" help page: from docs/install-app.md (the user's guide). Keep the two the same.
// The table of browsers is a list of buttons: a "#section" link would change the app route.
import { icon } from '../dom.js';

const IMG = './img/install';

// [section id, phone, browser]. help.js scrolls to the section when a button is tapped.
export const INSTALL_SECTIONS = [
    ['iphone-with-safari', 'iPhone', 'Safari'],
    ['iphone-with-chrome-edge-or-firefox', 'iPhone', 'Chrome, Edge or Firefox'],
    ['android-with-chrome', 'Android', 'Chrome'],
    ['android-with-samsung-internet', 'Android (Samsung)', 'Samsung Internet']
];

const external = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text} ${icon('external', 14)}</a>`;
const figure = (file, width, height, alt) => `<figure class="install-figure"><img src="${IMG}/${file}" width="${width}" height="${height}" alt="${alt}" loading="lazy"></figure>`;
const TOKEN_LINK = '<a href="#/help/token">How to create a GitHub token</a>';

export const INSTALL_PAGE = `
<p>Gorilla To Go is a web app. You do not get it from the App Store or Google Play. You install it from your phone's web browser.</p>
<p>When you install it, Gorilla To Go:</p>
<ul>
    <li>Gets its own icon on your home screen.</li>
    <li>Opens in its own window, without the browser's address bar.</li>
    <li>Opens even when you have no internet connection. (You need a connection to publish changes.)</li>
</ul>
<p>The address of the app is <strong>https://gorillatogo.app</strong></p>

<h2>Before you start</h2>
<ul>
    <li>Make sure your phone has an internet connection.</li>
    <li><strong>Install the app first. Then add your site.</strong> On an iPhone, the browser and the installed app keep their data in different places. A site or token that you add in the browser does not move into the installed app.</li>
    <li>Do not use a private (incognito) window. A private window cannot install apps.</li>
</ul>

<h2>Find your instructions</h2>
<ul class="install-jumps">
    ${INSTALL_SECTIONS.map(([id, phone, browser]) => `<li><button type="button" class="install-jump" data-jump="${id}"><span class="install-jump-text"><span>${phone}</span><strong>${browser}</strong></span>${icon('chevronRight', 18)}</button></li>`).join('\n    ')}
</ul>
<p>If you do not know which browser you use, use <strong>Safari</strong> on an iPhone. Use <strong>Chrome</strong> on an Android phone.</p>

<hr>

<h2 id="iphone-with-safari" tabindex="-1">iPhone with Safari</h2>
<p>These steps are for iOS 26 and later. For older iOS versions, see <button type="button" class="link-button" data-jump="older-iphones">Older iPhones</button>.</p>
<ol>
    <li>Open <strong>Safari</strong>.</li>
    <li>Go to <strong>https://gorillatogo.app</strong></li>
    <li>Wait until the Gorilla To Go welcome screen shows.</li>
    <li>Tap the <strong>•••</strong> (More) button next to the address bar.<br>
        If your Safari has a toolbar at the bottom or the top, tap the <strong>Share</strong> icon instead (a box with an up arrow). Then go to step 6.</li>
    <li>Tap <strong>Share</strong>.</li>
    <li>Scroll down the list.</li>
    <li>Tap <strong>Add to Home Screen</strong>.</li>
    <li>Make sure <strong>Open as Web App</strong> is on (green).</li>
    <li>Tap <strong>Add</strong>.</li>
</ol>
<p>The Gorilla To Go icon is now on your home screen.</p>
${figure('ios-safari-share.svg', 360, 360, 'Drawing: where to find Share in iPhone Safari. Tap the ••• button, then Share. Or tap the Share icon in the toolbar.')}
${figure('ios-add-to-home-screen.svg', 360, 510, 'Drawing: tap Add to Home Screen. Keep Open as Web App on. Tap Add.')}

<h3 id="older-iphones" tabindex="-1">Older iPhones</h3>
<p>On iOS 18 and earlier, the steps are almost the same:</p>
<ol>
    <li>Open <strong>Safari</strong>.</li>
    <li>Go to <strong>https://gorillatogo.app</strong></li>
    <li>Tap the <strong>Share</strong> icon (a box with an up arrow) in the toolbar.</li>
    <li>Scroll down the list.</li>
    <li>Tap <strong>Add to Home Screen</strong>.</li>
    <li>Tap <strong>Add</strong>.</li>
</ol>
<p>Older iOS versions do not show <strong>Open as Web App</strong>. The icon opens as an app automatically.</p>

<hr>

<h2 id="iphone-with-chrome-edge-or-firefox" tabindex="-1">iPhone with Chrome, Edge or Firefox</h2>
<p>You need iOS 16.4 or later.</p>
<ol>
    <li>Open your browser.</li>
    <li>Go to <strong>https://gorillatogo.app</strong></li>
    <li>Wait until the Gorilla To Go welcome screen shows.</li>
    <li>Find the <strong>Share</strong> button:
        <ul>
            <li><strong>Chrome:</strong> tap the <strong>Share</strong> icon in the address bar.</li>
            <li><strong>Edge:</strong> tap the <strong>•••</strong> menu. Then tap <strong>Share</strong>.</li>
            <li><strong>Firefox:</strong> tap the <strong>☰</strong> menu. Then tap <strong>Share</strong>.</li>
        </ul>
    </li>
    <li>Scroll down the list.</li>
    <li>Tap <strong>Add to Home Screen</strong>.</li>
    <li>If you see <strong>Open as Web App</strong>, make sure it is on (green).</li>
    <li>Tap <strong>Add</strong>.</li>
</ol>
<p>These browsers move their buttons from time to time. If you cannot find <strong>Add to Home Screen</strong>, use Safari.</p>
${figure('ios-other-browsers.svg', 360, 318, 'Drawing: where to find Share in Chrome, Edge and Firefox on iPhone.')}

<hr>

<h2 id="android-with-chrome" tabindex="-1">Android with Chrome</h2>
<ol>
    <li>Open <strong>Chrome</strong>.</li>
    <li>Go to <strong>https://gorillatogo.app</strong></li>
    <li>Wait until the Gorilla To Go welcome screen shows.</li>
    <li>Chrome can show an <strong>Install</strong> message at the bottom of the screen. If you see it, tap <strong>Install</strong>. Then go to step 8.</li>
    <li>Tap the <strong>⋮</strong> (three dots) menu at the top right.</li>
    <li>Tap the install row. The name of this row changes with your Chrome version. It is one of these:
        <ul>
            <li><strong>Install app</strong></li>
            <li><strong>Add to Home screen</strong></li>
            <li><strong>Install and create shortcut</strong></li>
        </ul>
    </li>
    <li>If Chrome asks you to select <strong>Install</strong> or <strong>Create shortcut</strong>, tap <strong>Install</strong>.</li>
    <li>Tap <strong>Install</strong> again if Chrome asks you to confirm.</li>
</ol>
<p>The Gorilla To Go icon is now on your home screen and in your app list.</p>
<p>Do not select <strong>Create shortcut</strong>. A shortcut opens Gorilla To Go in Chrome, with the address bar.</p>
${figure('android-chrome-menu.svg', 360, 400, "Drawing: Chrome's three-dot menu. Tap Install app, Add to Home screen, or Install and create shortcut.")}
${figure('android-chrome-install.svg', 360, 292, 'Drawing: when Chrome asks, tap Install, not Create shortcut.')}

<hr>

<h2 id="android-with-samsung-internet" tabindex="-1">Android with Samsung Internet</h2>
<ol>
    <li>Open <strong>Samsung Internet</strong>.</li>
    <li>Go to <strong>https://gorillatogo.app</strong></li>
    <li>Wait until the Gorilla To Go welcome screen shows.</li>
    <li>Look in the address bar for an install icon (a down arrow). If you see it, tap it. Then go to step 8.</li>
    <li>Tap the <strong>☰</strong> (three lines) menu at the bottom right.</li>
    <li>Tap <strong>Add page to</strong>.</li>
    <li>Tap <strong>Home screen</strong>.</li>
    <li>Tap <strong>Add</strong> or <strong>Install</strong>.</li>
</ol>
<p>The Gorilla To Go icon is now on your home screen.</p>
${figure('samsung-internet-menu.svg', 360, 378, 'Drawing: Samsung Internet menu. Tap Add page to, then Home screen.')}

<hr>

<h2>After you install</h2>
<p>This is the Gorilla To Go icon:</p>
<p><img class="install-icon" src="${IMG}/gtg-icon.png" alt="The Gorilla To Go icon" width="96" height="96"></p>
<ol>
    <li>Go to your home screen.</li>
    <li>Find the Gorilla To Go icon.</li>
    <li>Tap the icon.</li>
    <li>Make sure the app opens without the browser's address bar.</li>
    <li>Tap <strong>Add a site</strong>.</li>
</ol>
<p>You can close the browser tab. You do not need it again.</p>
<p>The welcome screen follows your phone's light or dark setting:</p>
<div class="install-pair">
    <figure class="install-figure"><img src="${IMG}/gtg-welcome-light.jpg" width="375" height="812" alt="Gorilla To Go welcome screen in light mode" loading="lazy"><figcaption>Light</figcaption></figure>
    <figure class="install-figure"><img src="${IMG}/gtg-welcome-dark.jpg" width="375" height="812" alt="Gorilla To Go welcome screen in dark mode" loading="lazy"><figcaption>Dark</figcaption></figure>
</div>

<h2>If something does not work</h2>
<ul>
    <li><strong>I cannot find "Add to Home Screen" or "Install":</strong> make sure you are not in a private window. Make sure your browser is up to date. On an iPhone, try Safari.</li>
    <li><strong>The link opened inside another app</strong> (for example Mail, Messages, Facebook or Instagram): those apps cannot install web apps. Copy the address. Open Safari (iPhone) or Chrome (Android). Paste the address.</li>
    <li><strong>The app opens with an address bar:</strong> you made a bookmark or a shortcut, not an app. Remove the icon. Then do the install steps again. On an iPhone, make sure <strong>Open as Web App</strong> is on. On Android, select <strong>Install</strong>, not <strong>Create shortcut</strong>.</li>
    <li><strong>My site is not in the app after I installed it:</strong> you added the site in the browser before you installed the app. Open the installed app. Add the site again.</li>
</ul>

<h2>Remove the app</h2>
<p><strong>Important:</strong> when you remove the app, you also remove the data that Gorilla To Go keeps on your phone: your tokens, your list of sites and all changes that you did not publish. Publish your changes first.</p>
<p><strong>iPhone:</strong></p>
<ol>
    <li>Touch and hold the Gorilla To Go icon.</li>
    <li>Tap <strong>Delete Bookmark</strong> (or <strong>Remove App</strong>).</li>
    <li>Tap <strong>Delete</strong> to confirm.</li>
</ol>
<p><strong>Android:</strong></p>
<ol>
    <li>Touch and hold the Gorilla To Go icon.</li>
    <li>Tap <strong>Uninstall</strong> (or <strong>Remove</strong>).</li>
    <li>Tap <strong>OK</strong> to confirm.</li>
</ol>

<hr>

<h2>iPhones and your data: the honest version</h2>
<p>Maybe you heard that web apps on iPhones "forget things". That is partly true. This section tells you what can happen, why, and what you can do.</p>

<h3>What Gorilla To Go keeps on your phone</h3>
<div class="table-scroll">
<table>
    <thead><tr><th>Kept on your phone only</th><th>Kept safe on GitHub</th></tr></thead>
    <tbody>
        <tr><td>Your GitHub tokens</td><td>Your published pages</td></tr>
        <tr><td>Your list of sites</td><td>Your published photos</td></tr>
        <tr><td>Changes that you did not publish (text and new photos)</td><td>Your site's settings and template</td></tr>
        <tr><td>Your theme setting (light or dark)</td><td></td></tr>
    </tbody>
</table>
</div>
<p><strong>Your website is never at risk.</strong> If your phone loses the Gorilla To Go data, your site stays the same. Only the items in the left column can be lost.</p>

<h3>What Apple does and does not promise</h3>
<p>Apple does not promise that a web app keeps its data forever. The data stays most of the time, but there is no guarantee. These are the known causes of data loss on an iPhone:</p>
<ol>
    <li><strong>You do not install the app.</strong> If you use Gorilla To Go in Safari (not from the home screen icon), Safari can delete its data after about 7 days without a visit. Installed web apps do not have this 7-day limit. <strong>This is the most important reason to install the app.</strong></li>
    <li><strong>Your iPhone is almost full.</strong> When storage is low, iOS can delete website data to make space. It deletes the data of the sites you used least recently first.</li>
    <li><strong>You delete the icon.</strong> This deletes the app's data at the same time.</li>
    <li><strong>You clear your website data</strong> in <strong>Settings</strong>. This can also clear the data of installed web apps.</li>
    <li><strong>You move to a new iPhone.</strong> Do not expect web app data to move with a backup or a transfer. Plan to add your sites again on the new phone.</li>
</ol>
<p>Some people also report data loss after an iOS update, with no clear cause. These reports are not common, and Apple does not explain them. We cannot promise that it will not happen to you.</p>

<h3>What Gorilla To Go does to help</h3>
<ul>
    <li>When it starts, Gorilla To Go asks iOS to keep its data permanently ("persistent storage"). iOS decides if it agrees. iOS is more likely to agree for an app that you installed on the home screen.</li>
    <li>Gorilla To Go saves your changes on the phone while you type, so a closed app does not lose your work.</li>
    <li>Gorilla To Go keeps only a copy of your page list on the phone. If the copy is lost, the app gets the list from GitHub again.</li>
</ul>

<h3>What you can do</h3>
<ol>
    <li><strong>Install the app.</strong> Do not use it in a browser tab.</li>
    <li><strong>Publish often.</strong> A change is safe only after you tap <strong>Publish</strong>. Do not keep large changes on the phone for days.</li>
    <li><strong>Keep free space on your iPhone.</strong> Go to <strong>Settings</strong> &gt; <strong>General</strong> &gt; <strong>iPhone Storage</strong> to see how much space you have.</li>
    <li><strong>Do not clear website data</strong> in Settings unless you must.</li>
    <li><strong>Know how to make a new token.</strong> A new token takes about 5 minutes. See ${TOKEN_LINK}.</li>
</ol>

<h3>If your data is gone</h3>
<p>You will see the Gorilla To Go welcome screen again, with no sites. Do these steps:</p>
<ol>
    <li>Make a new GitHub token for each site. See ${TOKEN_LINK}.</li>
    <li>On GitHub, delete the old tokens that you do not use now.</li>
    <li>In Gorilla To Go, tap <strong>Add a site</strong>.</li>
    <li>Add each site with its new token.</li>
    <li>We suggest you have a backup of your token somewhere safe (like in a password manager). While you can always create a new one, you can't recover one from GitHub after you've created it.</li>
</ol>
<p>Your published pages and photos are still there. Changes that you did not publish are gone.</p>

<h3>What about Android?</h3>
<p>Android phones delete web app data much less often. Chrome and Samsung Internet keep the data of installed apps unless the phone is very low on space, you clear the browser's data, or you uninstall the app. The advice above is good for Android too: install the app, and publish often.</p>

<hr>

<h3>More information</h3>
<p>These pages give the technical details (for readers who want them):</p>
<ul>
    <li>${external('https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios', 'Turn a website into an app in Safari on iPhone')} (Apple Support)</li>
    <li>${external('https://webkit.org/blog/14403/updates-to-storage-policy/', 'Updates to Storage Policy')} (WebKit, the engine of Safari)</li>
    <li>${external('https://synthetixis.com/writing/pwa-ios-2026', 'Progressive web apps on iPhone in 2026: what is true and what is folklore')} (Synthetixis)</li>
</ul>`;
