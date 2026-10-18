// Hash routing: #/, #/add, #/site/<id>, #/help/token, #/help/upgrade.
// Hash routes work at a domain root and at a subpath, and need no server rules.

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
            cleanup = (await handler(container, match.slice(1).map(decodeURIComponent))) || null;
            // Move focus to the screen title, so screen readers announce the new screen.
            container.querySelector('h1')?.focus({ preventScroll: true });
            return;
        }
    }
    navigate('#/', { replace: true });
}

export function startRouter(element) {
    container = element;
    window.addEventListener('hashchange', render);
    render();
}
