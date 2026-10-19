// Rules for the changelog (CHANGELOG.md): each entry starts with "## <version> — <date>".
// No network and no DOM here, so the rules run in tests.

const HEADING = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})\s*$/gm;

// [{ version, date }] of the entries, newest first.
export function entryHeadings(markdown) {
    return [...String(markdown).matchAll(HEADING)].map(([, version, date]) => ({ version, date }));
}

// The Markdown of the first count entries, without the title and the intro.
export function latestEntries(markdown, count) {
    const text = String(markdown).replace(/\r\n/g, '\n');
    const starts = [...text.matchAll(HEADING)].map(match => match.index);
    if (starts.length === 0) return '';
    const end = starts[count] ?? text.length;
    return text.slice(starts[0], end).trim();
}
