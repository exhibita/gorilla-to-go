import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP = path.join(ROOT, 'app');

// Every file under app/, as a path relative to app/ with forward slashes.
export function appFiles(dir = APP) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? appFiles(full) : [path.relative(APP, full).replace(/\\/g, '/')];
    });
}
