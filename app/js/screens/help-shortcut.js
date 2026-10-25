// The "Send photos from an iPhone" help page: from docs/ios-shortcut.md (the recipe for the owner). Keep the warning the same.
// To show the Add the Shortcut button, put the iCloud link of the Shortcut in SHORTCUT_LINK.
import { icon } from '../dom.js';

export const SHORTCUT_LINK = '';

const addStep = SHORTCUT_LINK
    ? `<a class="btn btn-primary" href="${SHORTCUT_LINK}" target="_blank" rel="noopener noreferrer">Add the Shortcut ${icon('external', 14)}</a>`
    : '<p>Ask the site owner for the Shortcut link.</p>';

export const SHORTCUT_PAGE = `
<div class="banner" role="note">
    <strong>Your photos stay in the site history</strong>
    <span>Each photo that the Shortcut sends goes into the history of the site repository. The photo stays in the history, also after you delete it.</span>
    <span>A photo can contain its location and other data. An iPhone photo is often a HEIC file.</span>
    <span>When the repository is public, anyone can see the history on github.com.</span>
    <span>For a public repository, do one of these:</span>
    <ul>
        <li>Remove the location before you send. In Photos, tap Share, tap <strong>Options</strong> at the top, and turn off <strong>Location</strong>. Do not change the Convert Image step of the Shortcut.</li>
        <li>Do not use the Shortcut. In the gallery, tap <strong>Add photos</strong>. The app removes the location and the other data before the upload.</li>
    </ul>
</div>

<p>The Shortcut sends photos from the Photos app on an iPhone to your site. Then you add the photos to a gallery in Gorilla To Go. You need iOS 17 or later.</p>

<h2>Set up the Shortcut</h2>
<ol>
    <li>Open the link of the Shortcut on your iPhone. ${addStep}</li>
    <li>In the Shortcuts app, tap <strong>Set Up Shortcut</strong>.</li>
    <li>Answer each question. When a question asks for a token, paste the GitHub token of that site. <a href="#/help/token">How to create a GitHub token</a></li>
    <li>Tap <strong>Add Shortcut</strong>.</li>
</ol>

<h2>Send photos</h2>
<ol>
    <li>Open the Photos app.</li>
    <li>Select one or more photos.</li>
    <li>Tap Share.</li>
    <li>Tap <strong>Send to Gorilla To Go</strong>. If you do not see it, scroll the row of apps and look for it, or tap <strong>More</strong>.</li>
    <li>Select the site.</li>
    <li>Wait for the notification.</li>
    <li>Open Gorilla To Go.</li>
    <li>Open the site. Tap the row that shows how many photos are waiting.</li>
    <li>Tap <strong>Add to a gallery</strong>.</li>
</ol>`;
