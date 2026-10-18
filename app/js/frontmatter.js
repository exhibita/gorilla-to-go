// Front matter of a Vanilla Gorilla page: the YAML block between the "---" lines at the top.
// This reads the part of YAML that the pages use: "key: value" scalars (plain, quoted, booleans,
// numbers, dates as text), empty keys, lists of scalars, lists of maps (the gallery "images:" list),
// "|" and ">" blocks, and comments. Anything else is an error, not a guess. Nothing here throws.

// Split a page into { data, body, raw, error }. raw is the YAML text; error is null or a message.
export function parseFrontmatter(text) {
    const source = String(text ?? '').replace(/^﻿/, '');
    const match = source.match(/^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/);
    if (!match) {
        const error = /^---[ \t]*\r?\n/.test(source) ? 'The front matter has no closing "---" line.' : null;
        return { data: {}, body: source, raw: '', error };
    }
    const raw = (match[1] ?? '').replace(/\r\n?/g, '\n');
    const body = source.slice(match[0].length);
    try {
        return { data: parseYaml(raw), body, raw, error: null };
    } catch (err) {
        return { data: {}, body, raw, error: err.message };
    }
}

// A page with "draft: true", or the text "true" in any case, is a draft (decision 22).
export function isDraft(data) {
    const value = data?.draft;
    return value === true || String(value).toLowerCase() === 'true';
}

const KEY_LINE = /^([A-Za-z0-9_][\w-]*)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/;
const ITEM_LINE = /^([ \t]*)-(?:[ \t]+(.*)|[ \t]*)$/;
const BLOCK = /^([|>])[+-]?(?:[ \t]+#.*)?$/;

const indentOf = line => line.match(/^[ \t]*/)[0].length;
const isBlankOrComment = line => /^[ \t]*(#.*)?$/.test(line);

function parseYaml(text) {
    const lines = text.split('\n');
    const data = {};
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (isBlankOrComment(line)) {
            i++;
            continue;
        }
        if (indentOf(line) > 0) throw new Error(`Line ${i + 1}: this line has an indent that the app cannot read.`);
        const match = line.match(KEY_LINE);
        if (!match) throw new Error(`Line ${i + 1}: this is not a "key: value" line.`);
        const key = match[1];
        if (Object.hasOwn(data, key)) throw new Error(`Line ${i + 1}: the key "${key}" is in the front matter two times.`);
        const rest = (match[2] ?? '').trim();
        i++;

        const block = rest.match(BLOCK);
        if (block) {
            const blockLines = [];
            while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) {
                blockLines.push(lines[i].trim());
                i++;
            }
            while (blockLines.at(-1) === '') blockLines.pop();
            data[key] = block[1] === '|'
                ? blockLines.join('\n')
                : blockLines.reduce((text, part) => (part === '' ? `${text}\n` : text && !text.endsWith('\n') ? `${text} ${part}` : text + part), '');
            continue;
        }

        if (rest !== '' && !rest.startsWith('#')) {
            data[key] = parseScalar(rest, i);
            continue;
        }

        // An empty value: a list follows, or the value is null.
        let next = i;
        while (next < lines.length && isBlankOrComment(lines[next])) next++;
        if (next < lines.length && ITEM_LINE.test(lines[next])) {
            const parsed = parseList(lines, next);
            data[key] = parsed.list;
            i = parsed.end;
        } else if (next < lines.length && indentOf(lines[next]) > 0) {
            throw new Error(`Line ${next + 1}: the app cannot read a map inside "${key}".`);
        } else {
            data[key] = null;
        }
    }
    return data;
}

// A list that starts at lines[start]. Items are scalars or maps ("- key: value" and indented keys).
function parseList(lines, start) {
    const base = indentOf(lines[start]);
    const list = [];
    let i = start;

    while (i < lines.length) {
        const line = lines[i];
        if (isBlankOrComment(line)) {
            i++;
            continue;
        }
        const indent = indentOf(line);
        const item = line.match(ITEM_LINE);
        if (item && indent === base) {
            const content = (item[2] ?? '').trim();
            i++;
            if (content === '') throw new Error(`Line ${i}: the app cannot read an empty list item.`);
            const pair = content.match(KEY_LINE);
            if (!pair || /^["']/.test(content)) {
                list.push(parseScalar(content, i));
                continue;
            }
            const map = { [pair[1]]: pair[2] ? parseScalar(pair[2].trim(), i) : null };
            while (i < lines.length && (isBlankOrComment(lines[i]) || (indentOf(lines[i]) > base && !ITEM_LINE.test(lines[i])))) {
                if (!isBlankOrComment(lines[i])) {
                    const more = lines[i].trim().match(KEY_LINE);
                    if (!more) throw new Error(`Line ${i + 1}: this is not a "key: value" line.`);
                    if (Object.hasOwn(map, more[1])) throw new Error(`Line ${i + 1}: the key "${more[1]}" is in this item two times.`);
                    map[more[1]] = more[2] ? parseScalar(more[2].trim(), i + 1) : null;
                }
                i++;
            }
            list.push(map);
            continue;
        }
        if (indent > base) throw new Error(`Line ${i + 1}: the app cannot read this list item.`);
        break; // A line at a lower indent, or a new key: the list ends.
    }
    return { list, end: i };
}

// One value: "double quoted", 'single quoted', true/false, null, a number, or plain text.
function parseScalar(value, lineNumber) {
    if (value.startsWith('"')) {
        let result = '';
        for (let i = 1; i < value.length; i++) {
            const char = value[i];
            if (char === '\\') {
                const escaped = value[++i];
                if (escaped === 'u' && /^[0-9a-fA-F]{4}$/.test(value.slice(i + 1, i + 5))) {
                    result += String.fromCharCode(parseInt(value.slice(i + 1, i + 5), 16));
                    i += 4;
                    continue;
                }
                result += { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', '0': '\0' }[escaped] ?? escaped;
            } else if (char === '"') {
                ensureOnlyComment(value.slice(i + 1), lineNumber);
                return result;
            } else {
                result += char;
            }
        }
        throw new Error(`Line ${lineNumber}: a quote (") is not closed.`);
    }
    if (value.startsWith("'")) {
        let result = '';
        for (let i = 1; i < value.length; i++) {
            if (value[i] === "'") {
                if (value[i + 1] === "'") {
                    result += "'";
                    i++;
                } else {
                    ensureOnlyComment(value.slice(i + 1), lineNumber);
                    return result;
                }
            } else {
                result += value[i];
            }
        }
        throw new Error(`Line ${lineNumber}: a quote (') is not closed.`);
    }
    if (/^[[{]/.test(value)) throw new Error(`Line ${lineNumber}: the app cannot read [ ] or { } values.`);

    const plain = value.replace(/[ \t]+#.*$/, '').trim();
    // The site build (gray-matter) refuses these plain values, or the app cannot read them (anchors),
    // so the app must not show the page as normal.
    if (/^[*&!@`%|>]|^[-?](\s|$)/.test(plain)) {
        throw new Error(`Line ${lineNumber}: the value starts with a character that YAML keeps for other uses. Put the value in quotes.`);
    }
    if (/:(\s|$)/.test(plain)) throw new Error(`Line ${lineNumber}: the value has ": " in it. Put the value in quotes.`);
    if (/^(true|True|TRUE)$/.test(plain)) return true;
    if (/^(false|False|FALSE)$/.test(plain)) return false;
    if (/^(null|Null|NULL|~)$/.test(plain)) return null;
    if (/^-?\d+(\.\d+)?$/.test(plain)) return Number(plain);
    return plain;
}

function ensureOnlyComment(rest, lineNumber) {
    if (!/^[ \t]*(#.*)?$/.test(rest)) throw new Error(`Line ${lineNumber}: there is text after the closing quote.`);
}
