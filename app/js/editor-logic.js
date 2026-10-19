// Toolbar actions for the Markdown textarea. Each takes and returns { text, start, end }
// (the text and the selection), so the actions run in tests without a DOM.

// Bold (**) or italic (_): wrap the selection, or remove the markers when they are already there.
export function toggleWrap({ text, start, end }, marker) {
    const m = marker.length;
    const selected = text.slice(start, end);
    if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
        return { text: text.slice(0, start) + selected.slice(m, -m) + text.slice(end), start, end: end - 2 * m };
    }
    if (text.slice(start - m, start) === marker && text.slice(end, end + m) === marker) {
        return { text: text.slice(0, start - m) + selected + text.slice(end + m), start: start - m, end: end - m };
    }
    return { text: text.slice(0, start) + marker + selected + marker + text.slice(end), start: start + m, end: end + m };
}

// Heading ("## ") or list ("- ") on each line of the selection. When every line has the prefix,
// remove it.
export function toggleLinePrefix({ text, start, end }, prefix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = text.indexOf('\n', Math.max(end - (end > start && text[end - 1] === '\n' ? 1 : 0), start));
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const lines = text.slice(lineStart, lineEnd).split('\n');
    const remove = lines.every(line => line.startsWith(prefix));

    let changeOnFirstLine = 0;
    let change = 0;
    const newLines = lines.map((line, index) => {
        if (remove) {
            if (index === 0) changeOnFirstLine = -prefix.length;
            change -= prefix.length;
            return line.slice(prefix.length);
        }
        if (line.startsWith(prefix)) return line;
        if (index === 0) changeOnFirstLine = prefix.length;
        change += prefix.length;
        return prefix + line;
    });

    const newStart = start === lineStart ? start : Math.max(lineStart, start + changeOnFirstLine);
    return {
        text: text.slice(0, lineStart) + newLines.join('\n') + text.slice(lineEnd),
        start: newStart,
        end: Math.max(newStart, end + change)
    };
}

// [selected text](https://) with the address selected, or [link text](https://) with "link text" selected.
export function insertLink({ text, start, end }) {
    const selected = text.slice(start, end);
    if (selected) {
        const linkStart = start + selected.length + 3;
        return { text: `${text.slice(0, start)}[${selected}](https://)${text.slice(end)}`, start: linkStart, end: linkStart + 'https://'.length };
    }
    return { text: `${text.slice(0, start)}[link text](https://)${text.slice(end)}`, start: start + 1, end: start + 1 + 'link text'.length };
}

const MAX_UNDO_STEPS = 200;

// The undo history of the editor. push() after each change; undo() returns the earlier state or null.
export function createHistory(initial) {
    const states = [{ ...initial }];
    return {
        push(state) {
            // The same text: no new step, but keep the new selection, so undo gives it back.
            if (state.text === states.at(-1).text) {
                states[states.length - 1] = { ...state };
                return;
            }
            states.push({ ...state });
            if (states.length > MAX_UNDO_STEPS + 1) states.shift();
        },
        undo() {
            if (states.length <= 1) return null;
            states.pop();
            return { ...states.at(-1) };
        },
        canUndo: () => states.length > 1
    };
}

// True when the line that starts at lineStart is inside a fenced code block. CommonMark: a fence
// opens with at most 3 spaces and ``` or ~~~; it closes with the same character, as long or longer,
// and no other text.
function insideFence(text, lineStart) {
    let open = null;
    for (const line of text.slice(0, lineStart).split('\n')) {
        const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (!fence) continue;
        if (!open) {
            if (!(fence[1][0] === '`' && fence[2].includes('`'))) open = fence[1];
        } else if (fence[1][0] === open[0] && fence[1].length >= open.length && fence[2].trim() === '') {
            open = null;
        }
    }
    return open !== null;
}

// True when the line before lineStart is paragraph text (not blank, not indented, not a list item,
// a quote or a heading). CommonMark: there, only a numbered list that starts at 1 begins a list.
function afterParagraph(text, lineStart) {
    if (lineStart === 0) return false;
    const before = text.slice(text.lastIndexOf('\n', lineStart - 2) + 1, lineStart - 1);
    return before.trim() !== '' && !/^(\s|[-*+]\s|\d{1,9}[.)]\s|>|#)/.test(before);
}

// After Enter (the cursor is just after the new line break): continue the list or the quote of the
// line before. "- a" gives "- ", "3. a" gives "4. ", "- [x] a" gives "- [ ] ", "> a" gives "> ",
// "> - a" gives "> - ". Enter on an empty item ends the list: the marker goes away, and the line
// stays blank, so the next paragraph is not part of the list. Returns { text, start, end, edit }
// (edit: { from, to, insert } for the textarea), or null when there is nothing to do.
export function continueList({ text, start, end }) {
    if (start !== end || text[start - 1] !== '\n') return null;
    const lineStart = text.lastIndexOf('\n', start - 2) + 1;
    const line = text.slice(lineStart, start - 1);
    if (insideFence(text, lineStart)) return null;
    // A rule (* * *, - - -) is not a list item.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return null;

    // A quote prefix ("> ", ">> "), then maybe a list item in the quote.
    const quote = line.match(/^\s*(?:>[ \t]?)+/)?.[0] ?? '';
    const rest = line.slice(quote.length);
    let marker = quote ? `${quote.trimEnd()} ` : '';
    let content = rest;
    let match;
    if ((match = rest.match(/^(\s*)([-*+])(\s+)(\[[ xX]\](?:\s+|$))?(.*)$/))) {
        marker += `${match[1]}${match[2]}${match[3]}${match[4] ? '[ ] ' : ''}`;
        content = match[5];
    } else if ((match = rest.match(/^(\s*)(\d{1,9})([.)])(\s+)(.*)$/))) {
        const number = Number(match[2]);
        if (number !== 1 && !quote && afterParagraph(text, lineStart)) return null; // "1999. was a year"
        marker += `${match[1]}${String(number + 1).padStart(match[2].length, '0')}${match[3]}${match[4]}`;
        content = match[5];
    } else if (!quote) {
        return null;
    }

    const nextBreak = text.indexOf('\n', start);
    const after = text.slice(start, nextBreak === -1 ? text.length : nextBreak);
    if (content.trim() === '' && after.trim() === '') {
        // An empty item: remove its marker. The line break that the user typed stays.
        const cursor = lineStart + 1;
        return { text: text.slice(0, lineStart) + text.slice(start - 1), start: cursor, end: cursor, edit: { from: lineStart, to: start - 1, insert: '' } };
    }
    const cursor = start + marker.length;
    return { text: text.slice(0, start) + marker + text.slice(start), start: cursor, end: cursor, edit: { from: start, to: start, insert: marker } };
}
