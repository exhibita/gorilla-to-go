import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleWrap, toggleLinePrefix, insertLink, createHistory } from '../app/js/editor-logic.js';

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
