// Write app/js/changelog-recent.js from CHANGELOG.md: the last 3 entries, for the offline "What is new"
// page. Run it after you add an entry: npm run changelog (a test checks that the two are the same).
import fs from 'node:fs';
import path from 'node:path';
import { latestEntries } from '../app/js/changelog.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const recent = latestEntries(changelog, 3);
if (/[`$\\]/.test(recent)) throw new Error('The last 3 entries have a `, $ or \\ character. Remove it, or change this script.');

const file = `// The last 3 entries of CHANGELOG.md, for the "What is new" page when the app is offline.
// Do not edit by hand: run npm run changelog (a test checks that this is the same as CHANGELOG.md).
export const RECENT_CHANGES = \`${recent}\`;
`;
fs.writeFileSync(path.join(root, 'app/js/changelog-recent.js'), file);
console.log('Wrote app/js/changelog-recent.js');
