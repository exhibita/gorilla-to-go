// Development server for app/. Node built-ins only.
// Usage: npm run dev  (PORT=5173 by default). For a phone, run "ngrok http 5173" and open the HTTPS URL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.join(APP_DIR, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);

    // Refuse paths that leave app/.
    if (!file.startsWith(APP_DIR + path.sep) && file !== APP_DIR) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
    }

    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
            // No caching, so a changed file shows at once. The service worker still caches for offline use.
            'Cache-Control': 'no-store'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Gorilla To Go dev server: http://localhost:${PORT}/`);
});
