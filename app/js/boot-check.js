// Start check. A classic script (not a module), loaded in <head> before the app.
// When a module of the app does not load or does not fit the others (for example files of two
// versions), the browser stops the whole app and the screen stays empty. This script sees that,
// clears the saved files of the app once and reloads. If the app still does not start, it shows a
// message with a Reload button. app.js sets window.__gtgStarted when the app runs.
(function () {
    var KEY = 'gtg.recovered';

    function started() {
        return window.__gtgStarted === true;
    }

    function showMessage() {
        var app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = '<div class="screen"><div class="screen-body">' +
            '<h1 class="page-title">The app did not start</h1>' +
            '<p>Make sure that the phone has a connection, then tap Reload.</p>' +
            '<button type="button" class="btn btn-primary" id="boot-reload">Reload</button>' +
            '</div></div>';
        document.getElementById('boot-reload').addEventListener('click', function () {
            location.reload();
        });
    }

    function recoverOrShowMessage() {
        if (started()) return;
        var tried = false;
        try {
            tried = sessionStorage.getItem(KEY) === '1';
            sessionStorage.setItem(KEY, '1');
        } catch (e) {
            tried = true; // No storage: do not reload, so there is no reload loop.
        }
        if (tried || !('caches' in window)) {
            showMessage();
            return;
        }
        // Remove the saved files and the service worker, then load everything again from the network.
        var jobs = [caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (key) { return key.indexOf('gtg-') === 0; }).map(function (key) { return caches.delete(key); }));
        })];
        if (navigator.serviceWorker) {
            jobs.push(navigator.serviceWorker.getRegistrations().then(function (registrations) {
                return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
            }));
        }
        Promise.all(jobs).then(function () { location.reload(); }, function () { location.reload(); });
    }

    // A script error before the app runs (a module that does not load or link). Image and other
    // resource errors are not script errors.
    window.addEventListener('error', function (event) {
        var scriptFailed = event instanceof ErrorEvent || (event.target && event.target.tagName === 'SCRIPT');
        if (scriptFailed && !started()) setTimeout(recoverOrShowMessage, 0);
    }, true);

    // The modules run before "load". If the app did not start a short time after that, it failed.
    window.addEventListener('load', function () {
        setTimeout(function () {
            if (!started()) recoverOrShowMessage();
        }, 4000);
    });
})();
