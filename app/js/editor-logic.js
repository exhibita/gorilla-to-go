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
            if (state.text === states.at(-1).text) return;
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
