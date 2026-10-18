// Write front matter changes with the smallest change to the file.
// - splitPage + composePage give back the same text, byte for byte (line endings, BOM, comments).
// - setFields changes only the lines of the fields that changed. Other keys and their order stay.
// - Text values are written in double quotes, so the YAML is always valid (mvp-plan section 9).
import { parseFrontmatter } from './frontmatter.js';

const BLOCK = /^(---[ \t]*\r?\n)(?:([\s\S]*?)(\r?\n))?(---[ \t]*(?:\r?\n|$))/;

// { bom, eol, raw, body, hasFrontmatter, open, close }. raw uses "\n" line endings.
export function splitPage(text) {
    const source = String(text ?? '');
    const bom = source.startsWith('﻿') ? '﻿' : '';
    const rest = source.slice(bom.length);
    const eol = /\r\n/.test(rest) ? '\r\n' : '\n';
    const match = rest.match(BLOCK);
    if (!match) return { bom, eol, raw: '', body: rest, hasFrontmatter: false, open: `---${eol}`, close: `---${eol}` };
    return {
        bom,
        eol,
        raw: (match[2] ?? '').replace(/\r\n/g, '\n'),
        body: rest.slice(match[0].length),
        hasFrontmatter: true,
        open: match[1],
        close: match[4]
    };
}

export function composePage({ bom = '', eol = '\n', raw, body, hasFrontmatter, open = `---${eol}`, close = `---${eol}` }) {
    if (!hasFrontmatter) return bom + body;
    const yaml = raw === '' ? '' : raw.split('\n').join(eol) + eol;
    return bom + open + yaml + close + body;
}

// A YAML double-quoted string that the front matter parser (and gray-matter) reads back the same.
export function yamlText(value) {
    const escaped = String(value).replace(/[\\"\u0000-\u001f\u007f]/g, char => {
        const named = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\t': '\\t', '\r': '\\r' }[char];
        return named ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
    return `"${escaped}"`;
}

const yamlValue = (key, value) => (key === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : yamlText(value));
const indentOf = line => line.match(/^[ \t]*/)[0].length;

// The lines of a top-level key: its own line, then the indented lines of a block or a list.
function keyRange(lines, key) {
    const start = lines.findIndex(line => new RegExp(`^${key}[ \\t]*:`).test(line));
    if (start === -1) return null;
    let end = start + 1;
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].trim() !== '' && indentOf(lines[i]) === 0) break;
        if (lines[i].trim() !== '') end = i + 1; // Blank lines count only when an indented line follows.
    }
    return { start, end };
}

// Set title, date and description in the YAML text. An empty value removes the key.
// A value that did not change keeps its line exactly as it is.
export function setFields(raw, fields) {
    const current = parseFrontmatter(`---\n${raw}\n---\n`).data;
    const lines = raw === '' ? [] : raw.split('\n');
    for (const key of ['title', 'date', 'description']) {
        if (!(key in fields)) continue;
        const value = String(fields[key] ?? '').trim() === '' ? '' : String(fields[key]);
        const before = current[key] == null ? '' : String(current[key]);
        if (value === before) continue;
        const range = keyRange(lines, key);
        const replacement = value === '' ? [] : [`${key}: ${yamlValue(key, value)}`];
        if (range) lines.splice(range.start, range.end - range.start, ...replacement);
        else lines.push(...replacement);
    }
    return lines.join('\n');
}
