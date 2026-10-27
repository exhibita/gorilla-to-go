// Hash routing: #/, #/add, #/site/<id>, #/site/<id>/page/<path>, #/site/<id>/edit/<path>, #/site/<id>/new, #/site/<id>/inbox, #/share/<shareId>, #/help/token, #/help/upgrade, #/help/install, #/help/shortcut, #/help/changes.
// Hash routes work at a domain root and at a subpath, and need no server rules.
import { escapeHtml } from './dom.js';

const routes = [];
const visited = []; // The hashes of this session, to know when "Back" can use the browser history.
let container;
let cleanup = null;

// handler(container, params) renders a screen. It can return a function that runs when the screen closes.
export function route(pattern, handler) {
    routes.push({ pattern, handler });
}

export function navigate(hash, { replace = false } = {}) {
    if (replace) {
        history.replaceState(null, '', hash);
        render();
    } else {
        location.hash = hash;
    }
}

// Go back in the app. If there is no earlier screen in this session, open the fallback.
export function back(fallback = '#/') {
    if (visited.length > 1) history.back();
    else navigate(fallback, { replace: true });
}

async function render() {
    const hash = location.hash || '#/';
    if (visited.at(-2) === hash) visited.pop();
    else if (visited.at(-1) !== hash) visited.push(hash);

    if (cleanup) {
        cleanup();
        cleanup = null;
    }
    for (const { pattern, handler } of routes) {
        const match = hash.match(pattern);
        if (match) {
            window.scrollTo(0, 0);
            // Each screen gets its own element. When the user opens another screen before this one
            // is ready, this element is no longer on the page, so late work here shows nothing.
            const target = document.createElement('div');
            container.replaceChildren(target);
            let result = null;
            try {
                result = (await handler(target, match.slice(1).map(decodeURIComponent))) || null;
            } catch (err) {
                console.error(err);
                if (target.isConnected) showError(target, err?.userMessage, err, hash);
            }
            if (!target.isConnected) {
                result?.(); // A newer screen is open: stop the work of this one.
                return;
            }
            cleanup = result;
            // Move focus to the screen title, so screen readers announce the new screen.
            target.querySelector('h1')?.focus({ preventScroll: true });
            return;
        }
    }
    navigate('#/', { replace: true });
}

// Shown when a screen cannot open, for example when the browser blocks storage.
// The details (error name, message, the screen and the first lines of the stack) help to find the
// cause. They contain no token: the app never puts the token in a message or a URL.
function showError(target, userMessage, err, hash) {
    const where = String(hash ?? '').replace(/\/(page|edit)\/.*/, '/$1/…');
    const stack = String(err?.stack ?? '').split('\n').slice(0, 4).join('\n');
    const details = err ? `${err.name ?? 'Error'}: ${err.message ?? err}\nScreen: ${where}\n${stack}` : '';
    target.innerHTML = `
<div class="screen">
    <div class="screen-body">
        <h1 class="page-title" tabindex="-1">The screen did not open</h1>
        <p>${userMessage ? escapeHtml(userMessage) : 'The app cannot open this screen.'}</p>
        ${userMessage ? '' : '<p class="muted">In a private window, the browser can stop the app from storing data. Use a normal window.</p>'}
        ${details ? `<pre class="error-details">${escapeHtml(details)}</pre>` : ''}
        <button type="button" class="btn btn-primary" data-reload>Try again</button>
        <a class="text-link" href="#/">Go to the start screen</a>
    </div>
</div>`;
    target.querySelector('[data-reload]').addEventListener('click', () => location.reload());
}

export function startRouter(element) {
    container = element;
    window.addEventListener('hashchange', render);
    render();
}
