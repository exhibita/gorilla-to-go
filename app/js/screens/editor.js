// Editor (mvp-plan section 6, screen 5): a plain textarea with a toolbar (decision 4), Write/Preview,
// Details for the front matter fields, and Publish. Changes are kept on the device while the user
// types. Publish commits with the SHA of the file the user opened, so a newer change on GitHub
// stops the save (mvp-plan section 9).
import { marked } from '../../vendor/marked/marked.esm.js';
import { getToken } from '../auth.js';
import { getSite } from '../sites.js';
import { getPageText, recordSavedPage, deviceStore } from '../pages.js';
import { parseFrontmatter } from '../frontmatter.js';
import { splitPage, composePage, setFields, editedBody } from '../frontmatter-write.js';
import { classifyPath, listTimeText, TYPE_LABELS } from '../pages-logic.js';
import { toggleWrap, toggleLinePrefix, insertLink, createHistory } from '../editor-logic.js';
import { getLocalEdit, saveLocalEdit, deleteLocalEdit } from '../edits.js';
import { saveFile, pathExists } from '../github.js';
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
    { id: 'undo', label: 'Undo', html: icon('undo') }
];

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
    }
    const siteHref = `#/site/${encodeURIComponent(site.id)}`;
    const backHref = isNew ? siteHref : pageHref;

    // The state of the editor: the file parts, the front matter fields, and the text in the textarea.
    let parts;
    let frontmatterError;
    let fields;
    const load = text => {
        parts = splitPage(text);
        const parsed = parseFrontmatter(text);
        frontmatterError = parsed.error;
        const value = key => (parsed.data[key] == null || typeof parsed.data[key] === 'object' ? '' : String(parsed.data[key]));
        fields = { title: value('title'), date: value('date'), description: value('description') };
    };
    load(startText);

    // The whole file as it is now. When the front matter cannot be read, it stays exactly as it is.
    // A textarea always uses "\n", so the text gets the line ending of the file back (CRLF files stay CRLF).
    const bodyText = () => editedBody(textarea.value, parts.body, parts.eol);
    const currentText = () => {
        if (frontmatterError) return composePage({ ...parts, body: bodyText() });
        const raw = setFields(parts.raw, fields);
        return composePage({ ...parts, raw, body: bodyText(), hasFrontmatter: parts.hasFrontmatter || raw !== '' });
    };

    container.innerHTML = `
<div class="screen editor-screen" id="editor-screen">
    <header class="topbar editor-topbar">
        <a class="icon-btn icon-btn--plain" href="${backHref}" data-back aria-label="${isNew ? 'Back to the pages' : 'Back to the page'}">${icon('back', 22)}</a>
        <div class="segmented" role="group" aria-label="View">
            <button type="button" data-mode="write" aria-pressed="true">Write</button>
            <button type="button" data-mode="preview" aria-pressed="false">Preview</button>
        </div>
        <button type="button" class="btn-publish" id="publish">Publish</button>
    </header>
    <div class="editor-head">
        <div class="editor-meta-row">
            <span class="type-label type-label--${kind.type}">${TYPE_LABELS[kind.type]}</span>
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
    </div>
    <p class="editor-status" id="editor-status" aria-live="polite"></p>
    <div class="editor-toolbar" role="toolbar" aria-label="Formatting">
        ${TOOLBAR.map(tool => `<button type="button" data-tool="${tool.id}" aria-label="${tool.label}">${tool.html}</button>`).join('')}
    </div>

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
            <p class="message-error" id="details-error" role="alert"></p>
            <button type="submit" class="btn btn-primary">Apply</button>
            <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        </form>
    </dialog>

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
    };

    textarea.value = parts.body;
    showTitle();
    let history = createHistory({ text: textarea.value, start: 0, end: 0 });

    if (frontmatterError) {
        $('#open-details').disabled = true;
        status('The app cannot read the front matter of this page. You can change the text. The front matter stays as it is.');
    }
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
                await saveLocalEdit({ siteId: site.id, path, baseSha, text });
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
            load(local.text);
            textarea.value = parts.body;
            showTitle();
            history = createHistory({ text: textarea.value, start: 0, end: 0 });
            banner.hidden = true;
            status(`Restored the changes from ${listTimeText(local.savedAt)}.`);
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
    textarea.addEventListener('input', () => {
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

    // ----- Write / Preview -----
    for (const button of container.querySelectorAll('[data-mode]')) {
        button.addEventListener('click', () => {
            const showPreview = button.dataset.mode === 'preview';
            for (const other of container.querySelectorAll('[data-mode]')) other.setAttribute('aria-pressed', String(other === button));
            if (showPreview) {
                // The same renderer and options as build.js: marked.parse(body) (decision 25).
                preview.replaceChildren(sanitizeHtml(marked.parse(textarea.value)));
            }
            preview.hidden = !showPreview;
            textarea.hidden = showPreview;
            $('.editor-toolbar').hidden = showPreview;
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
            description: typedDescription === fields.description.trim() ? fields.description : typedDescription
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
        const text = currentText();
        if (text === originalText) {
            status('There are no changes to publish.');
            return;
        }
        publishing = true;
        $('#publish').disabled = true;
        $('#open-delete-new')?.setAttribute('disabled', '');
        window.addEventListener('beforeunload', warnBeforeClose);
        status('Publishing. Keep the app open until this is complete.');
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
            const saved = await saveFile({
                owner: site.owner,
                repo: site.repo,
                branch: site.branch,
                path,
                text,
                // No SHA for a new page: GitHub then creates the file, and refuses when it exists.
                sha: baseSha ?? undefined,
                message: `${isNew ? 'Add' : 'Edit'} ${kind.slug} with Gorilla To Go`,
                token
            });
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
            status(`Published at ${listTimeText(Date.now())}. The site updates in a few minutes.`);
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
        viewport?.removeEventListener('resize', fit);
        viewport?.removeEventListener('scroll', fit);
        document.removeEventListener('visibilitychange', keepOnHide);
        window.removeEventListener('beforeunload', warnBeforeClose);
        clearTimeout(historyTimer);
        if (keepTimer) keepNow(); // Keep the last changes when the user leaves the editor.
    };
}
