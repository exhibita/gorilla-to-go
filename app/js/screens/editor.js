// Editor (mvp-plan section 6, screen 5): a plain textarea with a toolbar (decision 4), Write/Preview,
// Details for the front matter fields, and Publish. Changes are kept on the device while the user
// types. Publish commits with the SHA of the file the user opened, so a newer change on GitHub
// stops the save (mvp-plan section 9).
import { marked } from '../../vendor/marked/marked.esm.js';
import { getToken } from '../auth.js';
import { getSite } from '../sites.js';
import { getPageText, recordSavedPage, deviceStore } from '../pages.js';
import { parseFrontmatter, isDraft } from '../frontmatter.js';
import { splitPage, composePage, setFields, setImages, setDraft, editedBody } from '../frontmatter-write.js';
import { watchBuild, buildStatusHtml, showBuildStatus, rememberCommit } from '../build-status.js';
import { classifyPath, listTimeText, TYPE_LABELS } from '../pages-logic.js';
import { toggleWrap, toggleLinePrefix, insertLink, createHistory, continueList } from '../editor-logic.js';
import { getLocalEdit, saveLocalEdit, deleteLocalEdit } from '../edits.js';
import { saveFile, pathExists, commitFiles, listFolder, getImageDataUrl, gitBlobSha, base64ToBytes, listBuildRuns } from '../github.js';
import { imageFolder, imageName, markdownPath, markdownImage, referencedImages, namesInText, insertBlock, replaceImagePath, galleryItems, galleryImagePath, moveItem } from '../images.js';
import { prepareImage, ImageError } from '../image-resize.js';
import { sanitizeHtml } from '../sanitize.js';
import { escapeHtml, icon } from '../dom.js';
import { back, navigate } from '../router.js';

const KEEP_DELAY_MS = 800;
const HISTORY_DELAY_MS = 600;

// The address of the page on the site: src/blog/x/index.md → /blog/x/, src/notes.md → /notes.html.
const siteAddress = path => {
    const relative = path.replace(/^src\//, '');
    return relative.endsWith('index.md') ? `/${relative.slice(0, -'index.md'.length)}` : `/${relative.replace(/\.md$/, '.html')}`;
};

const TOOLBAR = [
    { id: 'heading', label: 'Heading', html: '<span class="tool-heading" aria-hidden="true">H</span>' },
    { id: 'bold', label: 'Bold', html: '<span class="tool-bold" aria-hidden="true">B</span>' },
    { id: 'italic', label: 'Italic', html: '<span class="tool-italic" aria-hidden="true">I</span>' },
    { id: 'link', label: 'Link', html: icon('link') },
    { id: 'list', label: 'List', html: icon('list') },
    { id: 'image', label: 'Insert image', html: icon('image') },
    { id: 'undo', label: 'Undo', html: icon('undo') }
];

// 412 KB, 1.4 MB.
const sizeText = bytes => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const dataUrl = image => `data:${image.mimeType};base64,${image.base64}`;

export async function editorScreen(container, [siteId, path]) {
    const site = await getSite(siteId);
    const kind = classifyPath(path);
    if (!site || !kind) {
        navigate('#/', { replace: true });
        return;
    }
    const pageHref = `#/site/${encodeURIComponent(site.id)}/page/${encodeURIComponent(path)}`;
    const controller = new AbortController();

    // ----- Load the page -----
    const cannotOpen = message => {
        container.innerHTML = `<div class="screen"><div class="screen-body"><h1 class="page-title" tabindex="-1">Cannot open the editor</h1>
            <div class="banner">${escapeHtml(message)}</div>
            <a class="btn btn-secondary" href="#/site/${encodeURIComponent(site.id)}">Go to the pages</a></div></div>`;
    };
    const list = await deviceStore.getPageList(site.id).catch(() => null);
    const entry = list?.pages.find(page => page.path === path);
    const token = await getToken(site.id);
    // A page on GitHub: originalText is its text and baseSha its SHA. A new page (step 5) is only on
    // this device: originalText is empty and there is no SHA, so Publish creates the file.
    let isNew = false;
    let originalText = '';
    let baseSha = null;
    let startText;
    // Photos added in the editor that are not on GitHub yet: [{ path, base64, mimeType }].
    let pendingImages = [];
    if (entry) {
        try {
            originalText = await getPageText({ site, token, sha: entry.sha, signal: controller.signal });
        } catch (err) {
            // For example no connection, and the page text is not saved on this device yet.
            cannotOpen(err.offline
                ? 'No connection. The text of this page is not saved on this device yet. Open the page again when you are online.'
                : `The app cannot read this page: ${err.message}`);
            return;
        }
        baseSha = entry.sha;
        startText = originalText;
    } else {
        const newPage = await getLocalEdit(site.id, path).catch(() => null);
        if (!newPage || newPage.baseSha) {
            cannotOpen('This page is not in the saved list. Go back to the pages and tap Refresh.');
            return;
        }
        isNew = true;
        startText = newPage.text;
        pendingImages = newPage.images ?? [];
    }
    const folder = imageFolder(path);
    // A gallery page has a Photos view for its images: list (step 8).
    const isGallery = kind.type === 'gallery';
    const siteHref = `#/site/${encodeURIComponent(site.id)}`;
    const backHref = isNew ? siteHref : pageHref;

    // The state of the editor: the file parts, the front matter fields, and the text in the textarea.
    let parts;
    let frontmatterError;
    let fields;
    let gallery = []; // The images: list of a gallery page.
    let hasCover = false; // With a cover: key, the first photo is not the cover.
    const load = text => {
        parts = splitPage(text);
        const parsed = parseFrontmatter(text);
        frontmatterError = parsed.error;
        const value = key => (parsed.data[key] == null || typeof parsed.data[key] === 'object' ? '' : String(parsed.data[key]));
        fields = { title: value('title'), date: value('date'), description: value('description'), draft: isDraft(parsed.data) };
        gallery = galleryItems(parsed.data);
        hasCover = Boolean(parsed.data.cover); // As the build: cover: false is no cover.
    };
    load(startText);

    // The whole file as it is now. When the front matter cannot be read, it stays exactly as it is.
    // A textarea always uses "\n", so the text gets the line ending of the file back (CRLF files stay CRLF).
    const bodyText = () => editedBody(textarea.value, parts.body, parts.eol);
    const currentText = () => {
        if (frontmatterError) return composePage({ ...parts, body: bodyText() });
        let raw = setDraft(setFields(parts.raw, fields), fields.draft);
        if (isGallery) raw = setImages(raw, gallery);
        return composePage({ ...parts, raw, body: bodyText(), hasFrontmatter: parts.hasFrontmatter || raw !== '' });
    };

    container.innerHTML = `
<div class="screen editor-screen" id="editor-screen">
    <header class="topbar editor-topbar">
        <a class="icon-btn icon-btn--plain" href="${backHref}" data-back aria-label="${isNew ? 'Back to the pages' : 'Back to the page'}">${icon('back', 22)}</a>
        <div class="segmented${isGallery ? ' segmented--three' : ''}" role="group" aria-label="View">
            <button type="button" data-mode="write" aria-pressed="true">Write</button>
            ${isGallery ? '<button type="button" data-mode="photos" aria-pressed="false">Photos</button>' : ''}
            <button type="button" data-mode="preview" aria-pressed="false">Preview</button>
        </div>
        <button type="button" class="btn-publish" id="publish">Publish</button>
    </header>
    <div class="editor-head">
        <div class="editor-meta-row">
            <span class="page-meta"><span class="type-label type-label--${kind.type}">${TYPE_LABELS[kind.type]}</span><span class="draft-label" id="draft-label" hidden>Draft</span></span>
            <span class="editor-head-actions">
                ${isNew ? '<button type="button" class="btn-small" id="open-delete-new" aria-haspopup="dialog">Delete</button>' : ''}
                <button type="button" class="btn-small" id="open-details" aria-haspopup="dialog">${icon('details', 16)} Details</button>
            </span>
        </div>
        <h1 class="editor-title" id="editor-title" tabindex="-1"></h1>
        <div class="muted small">${escapeHtml(siteAddress(path))}</div>
        <div class="banner" id="restore-banner" hidden></div>
    </div>
    <div class="editor-body">
        <label class="visually-hidden" for="editor-text">Page text (Markdown)</label>
        <textarea id="editor-text" class="editor-text" spellcheck="true" autocapitalize="sentences"></textarea>
        <div class="editor-preview prose" id="preview" hidden></div>
        ${isGallery ? `<div class="photos" id="photos" hidden>
            <button type="button" class="btn btn-secondary" id="add-photos">${icon('plus', 18)} Add photos</button>
            <p class="muted small" id="photos-hint"></p>
            <ol class="photo-grid" id="photo-grid"></ol>
            <input type="file" id="photo-files" accept="image/*" multiple hidden>
        </div>` : ''}
    </div>
    <p class="editor-status" id="editor-status" aria-live="polite"></p>
    <p class="build-status build-status--editor" id="build-status" aria-live="polite" hidden></p>
    <div class="editor-toolbar" role="toolbar" aria-label="Formatting">
        ${TOOLBAR.map(tool => `<button type="button" data-tool="${tool.id}" aria-label="${tool.label}">${tool.html}</button>`).join('')}
    </div>
    <input type="file" id="image-file" accept="image/*" hidden>

    <dialog class="sheet" id="image-sheet" aria-labelledby="image-sheet-title">
        <form class="sheet-body" id="image-form" novalidate>
            <h2 class="sheet-title" id="image-sheet-title">Add an image</h2>
            <img class="image-thumb" id="image-thumb" alt="">
            <p class="muted small" id="image-info"></p>
            <div class="field">
                <label for="image-alt">Alt text</label>
                <textarea class="input input-multiline" id="image-alt" rows="2"></textarea>
                <div class="field-hint">Describe the image for people who cannot see it.</div>
            </div>
            <p class="message-error" id="image-error" role="alert"></p>
            <button type="submit" class="btn btn-primary">Add image</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </form>
    </dialog>

    <dialog class="sheet" id="details" aria-labelledby="details-title">
        <form class="sheet-body" id="details-form" novalidate>
            <h2 class="sheet-title" id="details-title">Details</h2>
            <div class="field">
                <label for="field-title">Title</label>
                <input class="input" id="field-title" type="text" required>
            </div>
            <div class="field">
                <label for="field-date">Date</label>
                <input class="input" id="field-date" type="date">
            </div>
            <div class="field">
                <label for="field-description">Description</label>
                <textarea class="input input-multiline" id="field-description" rows="3"></textarea>
                <div class="field-hint">For search engines and the RSS feed.</div>
            </div>
            <label class="switch-row" for="field-draft">
                <input type="checkbox" id="field-draft">
                <span class="switch-text">
                    <span class="switch-title">Draft</span>
                    <span class="field-hint" id="field-draft-hint">The site does not show a draft. It is saved on GitHub.</span>
                </span>
            </label>
            <p class="message-error" id="details-error" role="alert"></p>
            <button type="submit" class="btn btn-primary">Apply</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </form>
    </dialog>

    ${isGallery ? `<dialog class="sheet" id="photo-sheet" aria-labelledby="photo-sheet-title">
        <form class="sheet-body" id="photo-form" novalidate>
            <h2 class="sheet-title" id="photo-sheet-title" aria-live="polite"></h2>
            <img class="image-thumb" id="photo-thumb" alt="" hidden>
            <p class="muted small" id="photo-path"></p>
            <div class="field">
                <label for="photo-alt">Alt text</label>
                <textarea class="input input-multiline" id="photo-alt" rows="2"></textarea>
                <div class="field-hint">Describe the image for people who cannot see it.</div>
            </div>
            <div class="field">
                <label for="photo-caption">Caption</label>
                <input class="input" id="photo-caption" type="text">
                <div class="field-hint">Shows on the photo and in the large view. Optional.</div>
            </div>
            <div class="sheet-row">
                <button type="button" class="btn btn-secondary" id="photo-earlier">Move earlier</button>
                <button type="button" class="btn btn-secondary" id="photo-later">Move later</button>
            </div>
            <button type="submit" class="btn btn-primary">Apply</button>
            <button type="button" class="btn btn-secondary" id="photo-remove">Remove from gallery</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </form>
    </dialog>` : ''}

    <dialog class="sheet" id="conflict" aria-labelledby="conflict-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="conflict-title">The page changed on GitHub</h2>
            <p id="conflict-text">Someone changed this page on GitHub after you opened it. The app did not publish, so the other change is safe.</p>
            <p id="conflict-advice">Your text stays on this device. Copy your text, open the new version of the page, and make your change again.</p>
            <p class="muted small" id="copy-status" aria-live="polite"></p>
            <button type="button" class="btn btn-primary" id="copy-text">Copy my text</button>
            <a class="btn btn-secondary" href="${siteHref}" id="conflict-pages">Go to the pages</a>
            <button type="button" class="btn btn-secondary" data-close>Close</button>
        </div>
    </dialog>

    <dialog class="sheet" id="delete-new" aria-labelledby="delete-new-title">
        <div class="sheet-body">
            <h2 class="sheet-title" id="delete-new-title">Delete this new page?</h2>
            <p>The page is not published. The app deletes it from this device. Nothing changes on GitHub.</p>
            <button type="button" class="btn btn-danger" id="confirm-delete-new">Delete page</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </div>
    </dialog>
</div>`;

    const $ = selector => container.querySelector(selector);
    const screen = $('#editor-screen');
    const textarea = $('#editor-text');
    const preview = $('#preview');
    const status = text => {
        $('#editor-status').textContent = text;
    };
    const showTitle = () => {
        $('#editor-title').textContent = (frontmatterError ? '' : fields.title) || kind.slug;
        // A draft: the Draft label shows, and Publish saves the draft to GitHub.
        const draft = !frontmatterError && fields.draft;
        $('#draft-label').hidden = !draft;
        $('#publish').textContent = draft ? 'Save draft' : 'Publish';
    };

    textarea.value = parts.body;
    showTitle();
    let history = createHistory({ text: textarea.value, start: 0, end: 0 });

    // Details and Photos change the front matter: they are off when the app cannot read it. Restore can
    // load another text, so it runs this again.
    const FRONTMATTER_ERROR_TEXT = 'The app cannot read the front matter of this page. You can change the text. The front matter stays as it is.';
    const applyFrontmatterState = () => {
        $('#open-details').disabled = Boolean(frontmatterError);
        container.querySelector('[data-mode="photos"]')?.toggleAttribute('disabled', Boolean(frontmatterError));
    };
    applyFrontmatterState();
    if (frontmatterError) status(FRONTMATTER_ERROR_TEXT);
    if (isNew) status('This page is not published yet. It is kept on this device until you tap Publish.');

    // ----- Delete a new page (only on this device) -----
    const deleteDialog = $('#delete-new');
    deleteDialog.querySelector('[data-close]').addEventListener('click', () => deleteDialog.close());
    $('#open-delete-new')?.addEventListener('click', () => deleteDialog.showModal());
    $('#confirm-delete-new').addEventListener('click', async () => {
        // During Publish the page can still go to GitHub, so Delete waits until Publish ends.
        if (publishing) return;
        clearTimeout(keepTimer);
        isDeleted = true;
        await deleteLocalEdit(site.id, path).catch(() => {});
        deleteDialog.close();
        back(siteHref); // The Pages list is the screen before (no extra history entry).
    });
    let isDeleted = false;

    // ----- Keep changes on the device -----
    let keepTimer = null;
    // While the Restore choice shows, nothing is kept: the earlier changes must stay until the user
    // taps Restore or Discard.
    let restorePending = false;
    const keepNow = async () => {
        clearTimeout(keepTimer);
        if (restorePending || isDeleted) return;
        const text = currentText();
        try {
            if (text === originalText) {
                await deleteLocalEdit(site.id, path);
            } else {
                // Only the photos that the text still uses are kept.
                const images = referencedImages(text, pendingImages);
                try {
                    await saveLocalEdit({ siteId: site.id, path, baseSha, text, images });
                } catch (err) {
                    // For example the device storage is full: keep at least the text.
                    if (!images.length) throw err;
                    await saveLocalEdit({ siteId: site.id, path, baseSha, text });
                    status('The app cannot keep the images on this device. Your text is kept. Publish soon.');
                    return;
                }
                status(`Not published. Your changes are kept on this device (${listTimeText(Date.now())}).`);
            }
        } catch {
            status('The app cannot keep your changes on this device. Publish soon.');
        }
    };
    const keepSoon = () => {
        clearTimeout(keepTimer);
        keepTimer = setTimeout(keepNow, KEEP_DELAY_MS);
    };

    // ----- Restore changes from an earlier visit -----
    const local = await getLocalEdit(site.id, path).catch(() => null);
    if (!isNew && local && local.text !== originalText) {
        const banner = $('#restore-banner');
        const changedSince = local.baseSha !== entry.sha
            ? ' The page also changed on GitHub after that, so Publish can stop.'
            : '';
        banner.innerHTML = `<span>This page has changes from ${escapeHtml(listTimeText(local.savedAt))} that are not published.${changedSince}</span>
            <span class="banner-actions"><button type="button" class="btn-small" id="restore">Restore</button><button type="button" class="btn-small" id="discard">Discard</button></span>`;
        banner.hidden = false;
        restorePending = true;
        $('#restore').addEventListener('click', () => {
            restorePending = false;
            // Publish with the SHA that the changes started from, so GitHub refuses the save when
            // the page changed after that.
            baseSha = local.baseSha;
            pendingImages = local.images ?? [];
            load(local.text);
            textarea.value = parts.body;
            showTitle();
            history = createHistory({ text: textarea.value, start: 0, end: 0 });
            applyFrontmatterState();
            // The Photos view is off for front matter that the app cannot read: show the text.
            if (frontmatterError && photos && !photos.hidden) container.querySelector('[data-mode="write"]').click();
            if (photos && !photos.hidden) renderPhotos();
            banner.hidden = true;
            status(`Restored the changes from ${listTimeText(local.savedAt)}.${frontmatterError ? ` ${FRONTMATTER_ERROR_TEXT}` : ''}`);
        });
        $('#discard').addEventListener('click', async () => {
            restorePending = false;
            await deleteLocalEdit(site.id, path).catch(() => {});
            banner.hidden = true;
            status('');
            keepNow(); // Keep what the user typed while the choice showed.
        });
    }

    // ----- Typing and the toolbar -----
    let historyTimer = null;
    const remember = () => history.push({ text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd });
    textarea.addEventListener('input', event => {
        // Enter in a list or a quote: start the next item, or end the list on an empty item. The
        // change goes in with setRangeText, so the phone keyboard and the cursor stay.
        const lineBreak = event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph' ||
            (event.inputType === 'insertText' && event.data === '\n');
        if (lineBreak && !event.isComposing) {
            const next = continueList({ text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd });
            if (next) textarea.setRangeText(next.edit.insert, next.edit.from, next.edit.to, 'end');
        }
        clearTimeout(historyTimer);
        historyTimer = setTimeout(remember, HISTORY_DELAY_MS);
        keepSoon();
    });

    const apply = state => {
        textarea.value = state.text;
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(state.start, state.end);
        keepSoon();
    };
    const actions = {
        heading: state => toggleLinePrefix(state, '## '),
        bold: state => toggleWrap(state, '**'),
        italic: state => toggleWrap(state, '_'),
        link: state => insertLink(state),
        list: state => toggleLinePrefix(state, '- ')
    };
    for (const button of container.querySelectorAll('[data-tool]')) {
        // Keep the focus (and the phone keyboard) in the textarea.
        button.addEventListener('pointerdown', event => event.preventDefault());
        button.addEventListener('click', () => {
            if (button.dataset.tool === 'image') {
                // One photo at a time, and not during Publish.
                if (preparing || publishing) return;
                // Remember where the image goes: the file picker takes the focus.
                imageSelection = { start: textarea.selectionStart, end: textarea.selectionEnd, text: textarea.value };
                fileInput.click();
                return;
            }
            clearTimeout(historyTimer);
            remember();
            if (button.dataset.tool === 'undo') {
                const earlier = history.undo();
                if (earlier) apply(earlier);
                else status('There is nothing to undo.');
                return;
            }
            const state = { text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd };
            apply(actions[button.dataset.tool](state));
            remember();
        });
    }

    // ----- Images (mvp-plan section 7) -----
    const fileInput = $('#image-file');
    const imageSheet = $('#image-sheet');
    let imageSelection = { start: 0, end: 0, text: '' };
    let newImage = null; // The photo in the sheet: { fileName, extension, base64, mimeType }.
    let preparing = false; // A photo is being made ready. Publish waits.
    let githubNames = []; // The file names in the image folder on GitHub, read when the photo was picked.
    let altAsked = false;

    // The file names in the image folder of this page on GitHub. None when the app cannot read them
    // now (for example offline): Publish checks the names again.
    const namesOnGitHub = async () => {
        try {
            return (await listFolder({ owner: site.owner, repo: site.repo, branch: site.branch, path: folder.slice(0, -1), token, signal: controller.signal, timeoutMs: 5000 }))
                .map(file => file.name);
        } catch {
            return [];
        }
    };
    const pendingNames = () => pendingImages.filter(image => image.path.startsWith(folder)).map(image => image.path.slice(folder.length));
    // A name that the text, another photo of this page and GitHub do not use.
    const freeName = (fileName, extension) => imageName(fileName, extension, [...namesInText(currentText(), folder), ...pendingNames(), ...githubNames]);

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = ''; // The same photo can be picked again.
        if (!file) return;
        status('Making the image ready.');
        preparing = true;
        let prepared;
        try {
            prepared = await prepareImage(file);
            githubNames = await namesOnGitHub();
        } catch (err) {
            status(err instanceof ImageError ? err.message : 'The app cannot read this image. Use a JPEG or PNG.');
            return;
        } finally {
            preparing = false;
        }
        if (!imageSheet.isConnected) return; // The user left the editor.
        newImage = { fileName: file.name, extension: prepared.extension, base64: prepared.base64, mimeType: prepared.mimeType };
        const name = freeName(file.name, prepared.extension);
        $('#image-thumb').src = dataUrl(newImage);
        $('#image-info').textContent = `${name}, ${prepared.width} × ${prepared.height} px, ${sizeText(prepared.size)}`;
        $('#image-alt').value = '';
        $('#image-error').textContent = '';
        altAsked = false;
        status('');
        imageSheet.showModal();
    });
    imageSheet.querySelector('[data-close]').addEventListener('click', () => imageSheet.close());
    imageSheet.addEventListener('close', () => {
        $('#image-thumb').removeAttribute('src');
        newImage = null;
    });
    $('#image-form').addEventListener('submit', event => {
        event.preventDefault();
        if (!newImage) return;
        const alt = $('#image-alt').value.trim();
        if (!alt && !altAsked) {
            altAsked = true;
            $('#image-error').textContent = 'Type a description. Or tap Add image again to add the image without a description.';
            $('#image-alt').focus();
            return;
        }
        // Choose the name again now: the text and the other photos can have changed since the pick.
        const image = { path: folder + freeName(newImage.fileName, newImage.extension), base64: newImage.base64, mimeType: newImage.mimeType };
        pendingImages = [...pendingImages, image];
        imageSheet.close();
        clearTimeout(historyTimer);
        remember();
        // When the text changed after the tap on the image button, the image goes at the cursor now.
        const where = textarea.value === imageSelection.text ? imageSelection : { start: textarea.selectionStart, end: textarea.selectionEnd };
        apply(insertBlock({ text: textarea.value, start: where.start, end: where.end }, markdownImage(alt, markdownPath(image.path))));
        remember();
        keepNow(); // Keep the photo on the device at once.
    });

    // Images of the site in the Preview, as data: URLs: added photos from the device, others from GitHub.
    const imageUrls = new Map(); // Repository path → Promise of a data: URL or null.
    const imageUrl = imagePath => {
        const pending = pendingImages.find(image => image.path === imagePath);
        if (pending) return Promise.resolve(dataUrl(pending));
        if (!imageUrls.has(imagePath)) {
            const url = getImageDataUrl({ owner: site.owner, repo: site.repo, branch: site.branch, path: imagePath, token, signal: controller.signal })
                .catch(() => null)
                .then(result => {
                    if (!result) imageUrls.delete(imagePath); // Try again at the next Preview (for example when online again).
                    return result;
                });
            imageUrls.set(imagePath, url);
        }
        return imageUrls.get(imagePath);
    };
    const showImages = () => {
        for (const img of preview.querySelectorAll('img[data-image-path]')) {
            const showNote = () => {
                const note = document.createElement('span');
                note.className = 'preview-image';
                note.textContent = `Image: ${img.alt || '(no alt text)'} (${markdownPath(img.dataset.imagePath)}). The app cannot show this image now.`;
                img.replaceWith(note);
            };
            img.addEventListener('error', showNote, { once: true }); // For example a file that is not an image.
            imageUrl(img.dataset.imagePath).then(url => {
                if (url) img.src = url;
                else showNote();
            });
        }
    };

    // ----- Photos of a gallery page (mvp-plan section 6, screen 6) -----
    const photos = $('#photos');
    const photoSheet = $('#photo-sheet');
    let photoIndex = -1; // The photo in the sheet.
    const isPhoto = item => item !== null && typeof item === 'object' && !Array.isArray(item);
    const textOf = value => (value == null ? '' : String(value));

    // The grid: one button per photo, with the thumbnail, the caption or the name, and marks.
    const renderPhotos = () => {
        if (!photos) return;
        $('#photos-hint').textContent = gallery.length
            ? `${gallery.length} ${gallery.length === 1 ? 'photo' : 'photos'}. Tap a photo to change its text or its place.${hasCover ? '' : ' The first photo is the cover on the gallery page.'}`
            : 'This gallery has no photos. Tap Add photos.';
        // The build uses the first item with a path as the cover, unless the page has cover:.
        const coverIndex = hasCover ? -1 : gallery.findIndex(item => isPhoto(item) && typeof item.path === 'string' && item.path.trim() !== '');
        $('#photo-grid').replaceChildren(...gallery.map((item, index) => {
            const photoPath = isPhoto(item) ? galleryImagePath(item.path) : null;
            const name = isPhoto(item) && typeof item.path === 'string' ? item.path.split('/').pop() : '(no path)';
            const label = isPhoto(item) ? textOf(item.caption) || textOf(item.alt) || name : String(item);
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'photo-card';
            button.setAttribute('aria-haspopup', 'dialog');
            button.addEventListener('click', () => openPhoto(index));
            const frame = document.createElement('span');
            frame.className = 'photo-frame';
            if (photoPath) {
                const img = document.createElement('img');
                img.alt = '';
                img.addEventListener('error', () => img.remove(), { once: true });
                imageUrl(photoPath).then(url => {
                    if (url) img.src = url;
                    else img.remove();
                });
                frame.append(img);
            }
            const marks = [];
            if (index === coverIndex) marks.push('Cover');
            if (pendingImages.some(image => image.path === photoPath)) marks.push('Not published');
            if (isPhoto(item) && !textOf(item.alt) && !textOf(item.caption)) marks.push('No alt text');
            const text = document.createElement('span');
            text.className = 'photo-label';
            text.textContent = label;
            const markList = document.createElement('span');
            markList.className = 'photo-marks';
            for (const mark of marks) {
                const chip = document.createElement('span');
                chip.className = `photo-mark${mark === 'No alt text' ? ' photo-mark--warn' : ''}`;
                chip.textContent = mark;
                markList.append(chip);
            }
            button.setAttribute('aria-label', `Photo ${index + 1}: ${label}${marks.length ? ` (${marks.join(', ')})` : ''}`);
            button.append(frame, text, markList);
            li.append(button);
            return li;
        }));
    };

    // The sheet for one photo: alt text, caption, place, remove.
    const fillPhotoSheet = () => {
        const item = gallery[photoIndex];
        const editable = isPhoto(item);
        $('#photo-sheet-title').textContent = `Photo ${photoIndex + 1} of ${gallery.length}`;
        $('#photo-path').textContent = editable ? textOf(item.path) || '(no path)' : `This item is not a photo: ${String(item)}`;
        $('#photo-alt').value = editable ? textOf(item.alt) : '';
        $('#photo-caption').value = editable ? textOf(item.caption) : '';
        $('#photo-alt').disabled = !editable;
        $('#photo-caption').disabled = !editable;
        $('#photo-earlier').disabled = photoIndex === 0;
        $('#photo-later').disabled = photoIndex === gallery.length - 1;
        const thumb = $('#photo-thumb');
        thumb.hidden = true;
        thumb.removeAttribute('src');
        const photoPath = editable ? galleryImagePath(item.path) : null;
        if (photoPath) {
            const shownItem = item;
            imageUrl(photoPath).then(url => {
                // The sheet can show another photo now (after a move, a remove or a new open).
                if (!url || gallery[photoIndex] !== shownItem || !photoSheet.open) return;
                thumb.src = url;
                thumb.hidden = false;
            });
        }
    };
    const openPhoto = index => {
        photoIndex = index;
        fillPhotoSheet();
        photoSheet.showModal();
    };
    // Put the typed text in the photo. An empty value takes the key out of the item.
    const takeTypedText = () => {
        const item = gallery[photoIndex];
        if (!isPhoto(item)) return;
        for (const key of ['alt', 'caption']) {
            const typed = $(`#photo-${key}`).value.replace(/\s+/g, ' ').trim(); // One line, as on the site.
            if (typed === textOf(item[key]).trim()) continue;
            if (typed) item[key] = typed;
            else delete item[key];
        }
    };
    const photosChanged = () => {
        renderPhotos();
        keepSoon();
    };
    photoSheet?.querySelector('[data-close]').addEventListener('click', () => photoSheet.close());
    $('#photo-form')?.addEventListener('submit', event => {
        event.preventDefault();
        takeTypedText();
        photoSheet.close();
        photosChanged();
    });
    for (const [id, step] of [['#photo-earlier', -1], ['#photo-later', 1]]) {
        $(id)?.addEventListener('click', () => {
            takeTypedText();
            gallery = moveItem(gallery, photoIndex, photoIndex + step);
            photoIndex += step;
            fillPhotoSheet();
            photosChanged();
            // At the first or last place this button is off: keep the focus in the sheet.
            if ($(id).disabled) $(step < 0 ? '#photo-later' : '#photo-earlier').focus();
        });
    }
    $('#photo-remove')?.addEventListener('click', () => {
        const removed = photoIndex;
        gallery = gallery.filter((_, index) => index !== removed);
        photoSheet.close();
        photosChanged();
        status('The photo is removed from the gallery. The image file stays in the repository.');
        // The card that opened the sheet is gone: put the focus on the photo now in its place.
        const cards = container.querySelectorAll('.photo-card');
        (cards[Math.min(removed, cards.length - 1)] ?? $('#add-photos')).focus();
    });

    // Add photos: several at once. Each one is made ready as in the editor (step 7).
    $('#add-photos')?.addEventListener('click', () => {
        if (publishing) {
            status('Wait until Publish is complete, then add photos.');
            return;
        }
        if (preparing) return;
        $('#photo-files').click();
    });
    $('#photo-files')?.addEventListener('change', async () => {
        const input = $('#photo-files');
        const files = [...input.files];
        input.value = '';
        if (!files.length) return;
        preparing = true;
        const problems = [];
        let added = 0;
        let lastAdded = null;
        try {
            githubNames = await namesOnGitHub();
            for (const [i, file] of files.entries()) {
                status(files.length === 1 ? 'Making the photo ready.' : `Making photo ${i + 1} of ${files.length} ready.`);
                try {
                    const prepared = await prepareImage(file);
                    const repoPath = folder + freeName(file.name, prepared.extension);
                    pendingImages = [...pendingImages, { path: repoPath, base64: prepared.base64, mimeType: prepared.mimeType }];
                    lastAdded = { path: markdownPath(repoPath) };
                    gallery = [...gallery, lastAdded];
                    added++;
                    renderPhotos();
                    keepSoon(); // Each photo is kept on the device, also when the user leaves now.
                } catch (err) {
                    problems.push(`${file.name}: ${err instanceof ImageError ? err.message : 'The app cannot read this image.'}`);
                }
            }
        } finally {
            preparing = false;
        }
        if (added) await keepNow();
        if (!photos.isConnected) return; // The user left the editor. The photos are kept.
        const one = added === 1 && files.length === 1;
        const addedText = added === 0 ? '' : `Added ${added} ${added === 1 ? 'photo' : 'photos'}. ${one ? '' : 'Tap each photo to add alt text and a caption. '}`;
        status(`${addedText}${problems.join(' ')}`.trim());
        // Ask for the alt text at once, unless the user opened a sheet meanwhile.
        const index = gallery.indexOf(lastAdded);
        if (one && index !== -1 && !photoSheet.open) openPhoto(index);
    });

    // ----- Write / Photos / Preview -----
    for (const button of container.querySelectorAll('[data-mode]')) {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            for (const other of container.querySelectorAll('[data-mode]')) other.setAttribute('aria-pressed', String(other === button));
            if (mode === 'preview') {
                // The same renderer and options as build.js: marked.parse(body) (decision 25).
                preview.replaceChildren(sanitizeHtml(marked.parse(textarea.value)));
                // A gallery page: the photos follow the text, as on the site.
                if (isGallery && gallery.length) {
                    const grid = document.createElement('div');
                    grid.className = 'preview-gallery';
                    for (const item of gallery.filter(isPhoto)) {
                        const photoPath = galleryImagePath(item.path);
                        if (!photoPath) {
                            const note = document.createElement('span');
                            note.className = 'preview-image';
                            note.textContent = `Image: ${textOf(item.alt ?? item.caption) || '(no alt text)'} (${textOf(item.path) || 'no path'})`;
                            grid.append(note);
                            continue;
                        }
                        const figure = document.createElement('figure');
                        const img = document.createElement('img');
                        img.alt = textOf(item.alt ?? item.caption);
                        img.dataset.imagePath = photoPath;
                        figure.append(img);
                        if (textOf(item.caption)) {
                            const caption = document.createElement('figcaption');
                            caption.textContent = textOf(item.caption);
                            figure.append(caption);
                        }
                        grid.append(figure);
                    }
                    preview.append(grid);
                }
                showImages();
            }
            if (mode === 'photos') renderPhotos();
            preview.hidden = mode !== 'preview';
            textarea.hidden = mode !== 'write';
            $('.editor-toolbar').hidden = mode !== 'write';
            if (photos) photos.hidden = mode !== 'photos';
        });
    }

    // ----- Details (front matter fields) -----
    const details = $('#details');
    details.querySelector('[data-close]').addEventListener('click', () => details.close());
    details.addEventListener('click', event => {
        if (event.target === details) details.close();
    });
    // A date that the date field cannot show (for example 2026-07-15T10:00:00Z) stays as it is,
    // unless the user changes the date field.
    let dateTouched = false;
    $('#field-date').addEventListener('input', () => {
        dateTouched = true;
    });
    $('#open-details').addEventListener('click', () => {
        $('#field-title').value = fields.title;
        $('#field-date').value = /^\d{4}-\d{2}-\d{2}$/.test(fields.date) ? fields.date : '';
        $('#field-description').value = fields.description;
        $('#field-draft').checked = fields.draft;
        $('#details-error').textContent = '';
        dateTouched = false;
        details.showModal();
    });
    $('#details-form').addEventListener('submit', event => {
        event.preventDefault();
        const typedTitle = $('#field-title').value.trim();
        if (!typedTitle) {
            $('#details-error').textContent = 'Type a title.';
            $('#field-title').focus();
            return;
        }
        const typedDescription = $('#field-description').value.trim();
        // Values that did not change keep their exact text, so their lines in the file do not change.
        fields = {
            title: typedTitle === fields.title.trim() ? fields.title : typedTitle,
            date: dateTouched ? $('#field-date').value : fields.date,
            description: typedDescription === fields.description.trim() ? fields.description : typedDescription,
            draft: $('#field-draft').checked
        };
        showTitle();
        details.close();
        keepNow();
    });

    // ----- Publish -----
    const conflict = $('#conflict');
    conflict.querySelector('[data-close]').addEventListener('click', () => conflict.close());
    $('#conflict-pages').addEventListener('click', () => conflict.close());
    $('#copy-text').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(currentText());
            $('#copy-status').textContent = 'Your text is on the clipboard.';
        } catch {
            $('#copy-status').textContent = 'The app cannot use the clipboard. Select the text in the editor and copy it.';
        }
    });

    // A photo whose name another file uses on GitHub gets a new name: in one commit, a file with the
    // same path replaces the other file. (A photo added offline was not checked.) The same photo,
    // for example from a publish that timed out, keeps its name. Letter case does not matter.
    // Returns a note for the user, or ''.
    const renameTakenImages = async () => {
        const onGitHub = await listFolder({ owner: site.owner, repo: site.repo, branch: site.branch, path: folder.slice(0, -1), token });
        const notes = [];
        for (const image of referencedImages(currentText(), pendingImages)) {
            const there = onGitHub.find(file => file.path.toLowerCase() === image.path.toLowerCase());
            if (!there || (there.path === image.path && there.sha === await gitBlobSha(base64ToBytes(image.base64)))) continue;
            const oldName = image.path.slice(folder.length);
            const taken = [...onGitHub.map(file => file.name), ...namesInText(currentText(), folder), ...pendingNames()];
            const name = imageName(oldName, oldName.split('.').pop(), taken);
            textarea.value = replaceImagePath(textarea.value, markdownPath(image.path), markdownPath(folder + name));
            // A gallery photo: its path in the images: list changes too.
            gallery = gallery.map(item => (isPhoto(item) && galleryImagePath(item.path) === image.path ? { ...item, path: markdownPath(folder + name) } : item));
            image.path = folder + name;
            notes.push(`A file with the name ${oldName} exists on GitHub, so the app changed the image name to ${name}.`);
        }
        if (!notes.length) return '';
        // Undo must not bring back the old name: that name is the other file on GitHub now.
        history = createHistory({ text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd });
        await keepNow();
        return notes.join(' ');
    };

    // ----- Publish status (mvp-plan section 6, screen 7) -----
    // After a save, the line under the status follows the site build of the commit until it ends.
    let buildWatch = null;
    const followBuild = (commitSha, { draft }) => {
        buildWatch?.abort();
        const line = $('#build-status');
        line.hidden = true;
        // The user left the editor during Publish, or the commit is not known: no status line.
        if (controller.signal.aborted || !commitSha) return false;
        buildWatch = new AbortController();
        const { signal } = buildWatch;
        watchBuild({
            list: () => listBuildRuns({ owner: site.owner, repo: site.repo, branch: site.branch, headSha: commitSha, token, signal }),
            sha: commitSha,
            signal,
            onChange: state => {
                showBuildStatus(line, buildStatusHtml(state, { draft }));
                line.hidden = false;
            }
        });
        return true;
    };

    let publishing = false;
    const warnBeforeClose = event => {
        event.preventDefault();
        event.returnValue = '';
    };
    $('#publish').addEventListener('click', async () => {
        if (publishing) return;
        if (!frontmatterError && !fields.title.trim()) {
            status('The page needs a title. Tap Details and type a title.');
            return;
        }
        if (preparing) {
            status('Wait until the image is ready, then tap Publish.');
            return;
        }
        if (currentText() === originalText) {
            status('There are no changes to publish.');
            return;
        }
        let renameNote = '';
        // A draft goes to GitHub too, but the site does not show it (decision 22).
        const asDraft = !frontmatterError && fields.draft;
        const working = asDraft ? 'Saving the draft. Keep the app open until this is complete.' : 'Publishing. Keep the app open until this is complete.';
        publishing = true;
        $('#publish').disabled = true;
        $('#open-delete-new')?.setAttribute('disabled', '');
        window.addEventListener('beforeunload', warnBeforeClose);
        status(working);
        await keepNow();
        try {
            if (isNew) {
                // GitHub refuses to create a file that exists. Also check the folder: a hand-made
                // index.html there would make the build skip the new index.md.
                const folder = path.slice(0, -'/index.md'.length);
                const taken = await pathExists({ owner: site.owner, repo: site.repo, branch: site.branch, path: folder, token })
                    .catch(err => {
                        if (err.offline) return false; // The save below then reports no connection.
                        throw err;
                    });
                if (taken) throw Object.assign(new Error('exists'), { conflict: true });
            }
            if (referencedImages(currentText(), pendingImages).length) renameNote = await renameTakenImages();
            const text = currentText();
            const images = referencedImages(text, pendingImages);
            const message = `${isNew ? 'Add' : 'Edit'} ${kind.slug} with Gorilla To Go`;
            let saved;
            if (images.length) {
                // The page and its images in one commit, so the site deploys once (mvp-plan section 7).
                saved = await commitFiles({
                    owner: site.owner,
                    repo: site.repo,
                    branch: site.branch,
                    page: { path, text, baseSha },
                    images,
                    message,
                    token,
                    onProgress: ({ done, total }) => status(done < total
                        ? `Uploading image ${done + 1} of ${total}. Keep the app open until this is complete.`
                        : working)
                });
                // The images are on GitHub now. The Preview keeps showing them without a download.
                for (const image of images) imageUrls.set(image.path, Promise.resolve(dataUrl(image)));
                pendingImages = pendingImages.filter(image => !images.includes(image));
                if (photos && !photos.hidden) renderPhotos(); // The "Not published" marks go away.
            } else {
                saved = await saveFile({
                    owner: site.owner,
                    repo: site.repo,
                    branch: site.branch,
                    path,
                    text,
                    // No SHA for a new page: GitHub then creates the file, and refuses when it exists.
                    sha: baseSha ?? undefined,
                    message,
                    token
                });
            }
            originalText = text;
            baseSha = saved.sha;
            await recordSavedPage({ site, path, sha: saved.sha, text });
            if (isNew) {
                // From now on this is a page on GitHub, and the address cannot change. Back still
                // goes to the Pages list, where the user came from.
                isNew = false;
                $('#open-delete-new')?.remove();
            }
            // Keep what the user typed during Publish (keepNow deletes the kept copy only when the
            // text is the same as the published text).
            await keepNow();
            rememberCommit(site.id, saved.commitSha); // The Pages list follows this build too.
            const following = followBuild(saved.commitSha, { draft: asDraft });
            status((asDraft
                ? `Saved as a draft at ${listTimeText(Date.now())}. The site does not show this page.`
                : `Published at ${listTimeText(Date.now())}.`) + (following ? '' : ' The site updates in a few minutes.'));
        } catch (err) {
            if (err.conflict && isNew) {
                status('Not published: a page with this address exists on GitHub. Your text is kept on this device.');
                $('#conflict-title').textContent = 'A page with this address exists';
                $('#conflict-text').textContent = 'Someone made a page with this address on GitHub. The app did not publish, so that page is safe.';
                $('#conflict-advice').textContent = 'Your text stays on this device. Copy your text, make a new page with a different address, and paste your text.';
                $('#copy-status').textContent = '';
                conflict.showModal();
            } else if (err.conflict) {
                status('Not published: the page changed on GitHub. Your changes are kept on this device.');
                $('#copy-status').textContent = '';
                conflict.showModal();
            } else if (err.offline) {
                status('No connection. Your changes are kept on this device. Publish again when you are online.');
            } else {
                status(`Not published: ${err.message}. Your changes are kept on this device.`);
            }
        } finally {
            // The rename note stays on the screen after the result of the publish.
            if (renameNote) status(`${$('#editor-status').textContent} ${renameNote}`);
            publishing = false;
            $('#publish').disabled = false;
            $('#open-delete-new')?.removeAttribute('disabled'); // Still a new page when Publish failed.
            window.removeEventListener('beforeunload', warnBeforeClose);
        }
    });

    // ----- Back -----
    container.querySelector('[data-back]').addEventListener('click', event => {
        event.preventDefault();
        back(backHref);
    });

    // ----- Keep the toolbar above the phone keyboard -----
    // iOS does not make the page smaller when the keyboard opens, so the screen follows the visual viewport.
    const viewport = window.visualViewport;
    const fit = () => {
        if (!viewport) return;
        screen.style.height = `${viewport.height}px`;
        screen.style.top = `${viewport.offsetTop}px`;
    };
    viewport?.addEventListener('resize', fit);
    viewport?.addEventListener('scroll', fit);
    fit();

    // When the app goes to the background (a phone can close it there), keep the changes at once.
    const keepOnHide = () => {
        if (document.visibilityState === 'hidden') keepNow();
    };
    document.addEventListener('visibilitychange', keepOnHide);

    return () => {
        controller.abort();
        buildWatch?.abort();
        viewport?.removeEventListener('resize', fit);
        viewport?.removeEventListener('scroll', fit);
        document.removeEventListener('visibilitychange', keepOnHide);
        window.removeEventListener('beforeunload', warnBeforeClose);
        clearTimeout(historyTimer);
        if (keepTimer) keepNow(); // Keep the last changes when the user leaves the editor.
    };
}
