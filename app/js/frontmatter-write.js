// Write front matter changes with the smallest change to the file.
// - splitPage + composePage give back the same text, byte for byte (line endings, BOM, comments).
// - setFields changes only the lines of the fields that changed. Other keys and their order stay.
// - Text values are written in double quotes, so the YAML is always valid (mvp-plan section 9).
import { parseFrontmatter } from './frontmatter.js';

const BLOCK = /^(---[ \t]*\r?\n)(?:([\s\S]*?)(\r?\n))?(---[ \t]*(?:\r?\n|$))/;

// { bom, eol, raw, body, hasFrontmatter, open, close, rawExact, fmEol }.
// raw uses "\n" line endings; rawExact is the front matter text with its own bytes. eol is the line
// ending of the body (for text typed in the editor); fmEol is the line ending of the front matter.
export function splitPage(text) {
    const source = String(text ?? '');
    const bom = source.startsWith('﻿') ? '﻿' : '';
    const rest = source.slice(bom.length);
    const match = rest.match(BLOCK);
    const body = match ? rest.slice(match[0].length) : rest;
    const fmEol = match ? (match[1].endsWith('\r\n') ? '\r\n' : '\n') : (/\r\n/.test(rest) ? '\r\n' : '\n');
    const eol = /\r\n/.test(body) ? '\r\n' : /\n/.test(body) ? '\n' : fmEol;
    if (!match) return { bom, eol, raw: '', body, hasFrontmatter: false, open: `---${eol}`, close: `---${eol}`, rawExact: '', fmEol };
    return {
        bom,
        eol,
        raw: (match[2] ?? '').replace(/\r\n/g, '\n'),
        body,
        hasFrontmatter: true,
        open: match[1],
        close: match[4],
        rawExact: match[2] === undefined ? '' : match[2] + match[3],
        fmEol
    };
}

// The page text from its parts. When raw did not change, the front matter keeps its exact bytes.
export function composePage({ bom = '', eol = '\n', raw, body, hasFrontmatter, open, close, rawExact, fmEol = eol }) {
    if (!hasFrontmatter) return bom + body;
    const unchanged = rawExact !== undefined && raw === rawExact.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const yaml = unchanged ? rawExact : raw === '' ? '' : raw.split('\n').join(fmEol) + fmEol;
    return bom + (open ?? `---${fmEol}`) + yaml + (close ?? `---${fmEol}`) + body;
}

// The body to save: the original bytes when the text in the textarea did not change (a textarea
// shows every line ending as "\n"), else the textarea text with the line ending of the body.
export function editedBody(textareaValue, originalBody, eol) {
    if (textareaValue === originalBody.replace(/\r\n?/g, '\n')) return originalBody;
    return textareaValue.replace(/\n/g, eol);
}

// A YAML double-quoted string that the front matter parser (and gray-matter) reads back the same.
export function yamlText(value) {
    // U+0085, U+2028 and U+2029 are line breaks for some YAML readers: escape them too.
    const escaped = String(value).replace(/[\\"\u0000-\u001f\u007f\u0085\u2028\u2029]/g, char => {
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

// Set title, date, description, and the image and image_alt of a links page, in the YAML text. An
// empty value removes the key. A value that did not change keeps its line exactly as it is.
export function setFields(raw, fields) {
    const current = parseFrontmatter(`---\n${raw}\n---\n`).data;
    const lines = raw === '' ? [] : raw.split('\n');
    for (const key of ['title', 'date', 'description', 'image', 'image_alt']) {
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

// Set a true/false key: "key: true" (the boolean) when on, no key when off. As in build.js, the
// boolean true and the text "true" in any case are on. The text changes only when the state changes,
// so draft: "TRUE" stays as it is on a draft, and sitemap: false stays when the switch stays off.
export function setFlag(raw, key, on) {
    const parsed = parseFrontmatter(`---\n${raw}\n---\n`);
    const value = parsed.data[key];
    if (parsed.error || (value === true || String(value).toLowerCase() === 'true') === on) return raw;
    const lines = raw === '' ? [] : raw.split('\n');
    const range = keyRange(lines, key);
    const replacement = on ? [`${key}: true`] : [];
    if (range) lines.splice(range.start, range.end - range.start, ...replacement);
    else lines.push(...replacement);
    return lines.join('\n');
}

// Make the page a draft (draft: true, decision 22) or not (no draft key).
export const setDraft = (raw, draft) => setFlag(raw, 'draft', draft);

// Set a text of more than one line, for example the css: of a links page, as a "|" block. An empty
// text removes the key. Blank lines at the end do not count, and the text changes only when the
// value changes, so a block that the user did not change keeps its bytes.
export function setBlock(raw, key, text) {
    const parsed = parseFrontmatter(`---\n${raw}\n---\n`);
    if (parsed.error) return raw;
    const trimEnd = value => (typeof value === 'string' ? value.replace(/\s+$/, '') : '');
    const value = trimEnd(String(text ?? '').replace(/\r\n?/g, '\n'));
    if (value === trimEnd(parsed.data[key]) && (value !== '' || !Object.hasOwn(parsed.data, key))) return raw;
    // A digit gives the indent when the first line starts with a space (YAML would read it as the indent).
    const replacement = value === '' ? [] : [
        `${key}: |${value.startsWith(' ') ? '2' : ''}`,
        ...value.split('\n').map(line => (line.trim() === '' ? '' : `  ${line}`))
    ];
    const lines = raw === '' ? [] : raw.split('\n');
    const range = keyRange(lines, key);
    if (range) lines.splice(range.start, range.end - range.start, ...replacement);
    else lines.push(...replacement);
    return lines.join('\n');
}

// A value in a list item. A simple images: path stays plain, as in the template; other text is quoted.
function itemValue(key, value) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string') return String(value);
    // Only a value with a "/": a plain true, null, 1e3 or 2024-01-01 would not read back as text.
    return key === 'path' && /^[\w./-]+$/.test(value) && value.includes('/') && !value.startsWith('-') ? value : yamlText(value);
}

// The lines of a list block. An empty text value is left out (in an images: item, the build then
// uses the caption as the alt text).
function listLines(key, items) {
    const lines = [`${key}:`];
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            lines.push(`  - ${typeof item === 'string' ? yamlText(item) : String(item)}`);
            continue;
        }
        const entries = Object.entries(item).filter(([, value]) => value !== '' && value !== undefined);
        entries.forEach(([key, value], i) => {
            const text = itemValue(key, value);
            lines.push(`${i === 0 ? '  - ' : '    '}${key}:${text === '' ? '' : ` ${text}`}`);
        });
    }
    return lines;
}

// Set a list of maps: the gallery images: list (decision 21) or the links: list of a links page.
// Only the block of the key changes, and only when the list changed. The list items are written
// with two spaces before "-".
export function setList(raw, key, items) {
    const parsed = parseFrontmatter(`---\n${raw}\n---\n`);
    if (parsed.error) return raw;
    const current = Array.isArray(parsed.data[key]) ? parsed.data[key] : [];
    const hasKey = Object.hasOwn(parsed.data, key);
    if (listLines(key, current).join('\n') === listLines(key, items).join('\n') && (hasKey || items.length === 0)) return raw;

    const lines = raw === '' ? [] : raw.split('\n');
    const start = lines.findIndex(line => new RegExp(`^${key}[ \\t]*:`).test(line));
    if (start === -1) return [...lines, ...listLines(key, items)].join('\n');
    // The key line, then the lines of its list: indented lines and items at column 0. Blank lines and
    // comments after the last item stay (a comment there can be about the next key). Comments between
    // the items go away when the list changes.
    let end = start + 1;
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].trim() === '' || lines[i].trim().startsWith('#')) continue;
        if (indentOf(lines[i]) === 0 && !lines[i].startsWith('-')) break;
        end = i + 1;
    }
    lines.splice(start, end - start, ...listLines(key, items));
    return lines.join('\n');
}

export const setImages = (raw, items) => setList(raw, 'images', items);
