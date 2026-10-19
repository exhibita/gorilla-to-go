import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleWrap, toggleLinePrefix, insertLink, createHistory, continueList } from '../app/js/editor-logic.js';

// "Hello [world]" → { text, start, end } with the selection between the brackets.
const at = marked => {
    const start = marked.indexOf('[');
    const end = marked.indexOf(']') - 1;
    return { text: marked.replace('[', '').replace(']', ''), start, end };
};
const show = ({ text, start, end }) => `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`;

test('bold wraps the selection and keeps it selected', () => {
    assert.equal(show(toggleWrap(at('Hello [world] now'), '**')), 'Hello **[world]** now');
});

test('bold again removes the markers', () => {
    assert.equal(show(toggleWrap(at('Hello **[world]** now'), '**')), 'Hello [world] now');
    assert.equal(show(toggleWrap(at('Hello [**world**] now'), '**')), 'Hello [world] now');
});

test('bold with no selection inserts the markers and puts the cursor between them', () => {
    assert.equal(show(toggleWrap(at('Hello [] now'), '**')), 'Hello **[]** now');
});

test('italic uses one underscore', () => {
    assert.equal(show(toggleWrap(at('[word]'), '_')), '_[word]_');
});

test('heading adds "## " to the line, and removes it again', () => {
    assert.equal(show(toggleLinePrefix(at('Intro\nMy [title]\nEnd'), '## ')), 'Intro\n## My [title]\nEnd');
    assert.equal(show(toggleLinePrefix(at('Intro\n## My [title]\nEnd'), '## ')), 'Intro\nMy [title]\nEnd');
});

test('list adds "- " to every selected line, and removes it when all lines have it', () => {
    assert.equal(show(toggleLinePrefix(at('[One\nTwo]\nThree'), '- ')), '[- One\n- Two]\nThree');
    assert.equal(show(toggleLinePrefix(at('[- One\n- Two]\nThree'), '- ')), '[One\nTwo]\nThree');
});

test('link makes [text](https://) and selects the address part', () => {
    const result = insertLink(at('See [the docs] here'));
    assert.equal(result.text, 'See [the docs](https://) here');
    assert.equal(result.text.slice(result.start, result.end), 'https://');
});

test('link with no selection inserts [link text](https://) and selects "link text"', () => {
    const result = insertLink(at('Go []'));
    assert.equal(result.text, 'Go [link text](https://)');
    assert.equal(result.text.slice(result.start, result.end), 'link text');
});

test('undo goes back one step at a time, and redo is cleared by a new change', () => {
    const history = createHistory({ text: 'a', start: 1, end: 1 });
    history.push({ text: 'ab', start: 2, end: 2 });
    history.push({ text: 'abc', start: 3, end: 3 });
    assert.equal(history.canUndo(), true);
    assert.deepEqual(history.undo(), { text: 'ab', start: 2, end: 2 });
    assert.deepEqual(history.undo(), { text: 'a', start: 1, end: 1 });
    assert.equal(history.undo(), null);
    assert.equal(history.canUndo(), false);
});

test('undo keeps no more than 200 steps', () => {
    const history = createHistory({ text: '', start: 0, end: 0 });
    for (let i = 1; i <= 250; i++) history.push({ text: 'x'.repeat(i), start: i, end: i });
    let steps = 0;
    while (history.undo()) steps++;
    assert.equal(steps, 200);
});

test('push ignores a state with the same text as the last one', () => {
    const history = createHistory({ text: 'a', start: 1, end: 1 });
    history.push({ text: 'a', start: 0, end: 0 });
    assert.equal(history.canUndo(), false);
});

test('undo after bold gives back the selected word, so bold can be used again on it', () => {
    const history = createHistory({ text: 'Hello world', start: 0, end: 0 });
    history.push({ text: 'Hello world', start: 6, end: 11 }); // The user selects "world".
    history.push({ text: 'Hello **world**', start: 8, end: 13 }); // Bold.
    assert.deepEqual(history.undo(), { text: 'Hello world', start: 6, end: 11 });
});

// ---------- continueList: the text just after the user typed Enter; | is the cursor ----------

const afterEnter = marked => ({ text: marked.replace('|', ''), start: marked.indexOf('|'), end: marked.indexOf('|') });
const result = state => (state ? `${state.text.slice(0, state.start)}|${state.text.slice(state.start)}` : null);

test('continueList starts the next item of a bullet list', () => {
    assert.equal(result(continueList(afterEnter('- one\n|'))), '- one\n- |');
    assert.equal(result(continueList(afterEnter('* one\n|'))), '* one\n* |');
    assert.equal(result(continueList(afterEnter('Intro\n\n  + one\n|\nAfter'))), 'Intro\n\n  + one\n  + |\nAfter', 'indent and marker stay');
});

test('continueList counts on in a numbered list, and a task list starts an open task', () => {
    assert.equal(result(continueList(afterEnter('1. one\n|'))), '1. one\n2. |');
    assert.equal(result(continueList(afterEnter('9) nine\n|'))), '9) nine\n10) |');
    assert.equal(result(continueList(afterEnter('- [x] done\n|'))), '- [x] done\n- [ ] |');
});

test('continueList continues a quote', () => {
    assert.equal(result(continueList(afterEnter('> A quote\n|'))), '> A quote\n> |');
});

test('continueList ends the list when the item is empty', () => {
    assert.equal(result(continueList(afterEnter('- one\n- \n|'))), '- one\n|');
    assert.equal(result(continueList(afterEnter('- one\n- \n|\nNext'))), '- one\n|\nNext');
    assert.equal(result(continueList(afterEnter('1. one\n2. \n|'))), '1. one\n|');
    assert.equal(result(continueList(afterEnter('> \n|'))), '|');
});

test('continueList splits an item: the text after the cursor becomes the next item', () => {
    assert.equal(result(continueList(afterEnter('- one\n|two'))), '- one\n- |two');
    assert.equal(result(continueList(afterEnter('- \n|two'))), '- \n- |two', 'Enter just after the marker');
});

test('continueList does nothing outside a list, in a code block, on a rule, or with a selection', () => {
    assert.equal(continueList(afterEnter('Text\n|')), null);
    assert.equal(continueList(afterEnter('**bold**\n|')), null);
    assert.equal(continueList(afterEnter('-not a list\n|')), null);
    assert.equal(continueList(afterEnter('```\n- code\n|')), null);
    assert.equal(continueList(afterEnter('* * *\n|')), null);
    assert.equal(continueList(afterEnter('- - -\n|')), null);
    assert.equal(continueList({ text: '- one\nx', start: 6, end: 7 }), null);
    assert.equal(continueList(afterEnter('- one|')), null, 'no line break before the cursor');
});

test('continueList gives the edit for the textarea', () => {
    assert.deepEqual(continueList(afterEnter('- one\n|')).edit, { from: 6, to: 6, insert: '- ' });
    assert.deepEqual(continueList(afterEnter('- one\n- \n|')).edit, { from: 6, to: 9, insert: '' });
});
