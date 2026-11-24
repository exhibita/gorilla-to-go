// The "Add HEIC photos" help page (#37, decision 40). The app cannot read HEIC on Android and on most
// computer browsers, so this page tells the user how to make a JPEG copy.

export const HEIC_PAGE = `
<p>An iPhone saves photos as HEIC files. Android phones and most computer browsers cannot read HEIC files. Safari can.</p>
<p>When the browser cannot read a HEIC photo, Gorilla To Go cannot make a copy for your site. Save the photo as a JPEG, then add it again.</p>

<h2>On a computer (for many photos)</h2>
<ol>
    <li>Open Google Photos in a browser.</li>
    <li>Open the album.</li>
    <li>Click the photo. The photo opens full screen.</li>
    <li>Right-click the photo.</li>
    <li>Select <strong>Save image as</strong>. The browser saves the photo as a JPEG or PNG file.</li>
</ol>

<h2>On the phone (for 1 or 2 photos)</h2>
<ol>
    <li>Open the photo full screen in Google Photos.</li>
    <li>Wait until the buttons go away.</li>
    <li>Take a screenshot.</li>
</ol>
<p>The screenshot is a JPEG or PNG file. It can be smaller than the original photo.</p>

<h2>On the phone (for many photos)</h2>
<ol>
    <li>Open the photo in Google Photos.</li>
    <li>Tap <strong>⋮</strong> (More).</li>
    <li>Tap <strong>Download</strong>.</li>
    <li>Convert the downloaded file with a HEIC to JPEG converter app from Google Play.</li>
</ol>

<h2>On the iPhone that takes the photos</h2>
<p>The iPhone can save new photos as JPEG files:</p>
<ol>
    <li>Open <strong>Settings</strong>.</li>
    <li>Tap <strong>Camera</strong>.</li>
    <li>Tap <strong>Formats</strong>.</li>
    <li>Tap <strong>Most Compatible</strong>.</li>
</ol>
<p>Photos that the iPhone took before this change stay HEIC files.</p>`;
