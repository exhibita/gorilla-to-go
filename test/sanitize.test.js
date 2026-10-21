// The Preview sanitizer is the line between repository content (a collaborator can write anything)
// and the app origin, which holds the GitHub tokens. These tests run it in jsdom, whose HTML parser
// (parse5) follows the same HTML5 parsing algorithm as the browsers, so parser tricks parse the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = window.DOMParser;
globalThis.document = window.document;

const { sanitizeHtml } = await import('../app/js/sanitize.js');
const { marked } = await import('../app/vendor/marked/marked.esm.js');

// The sanitized HTML as text, as the Preview would hold it.
function clean(html) {
    const div = document.createElement('div');
    div.append(sanitizeHtml(html));
    return div.innerHTML;
}

// What must never come out of the sanitizer.
const DANGEROUS = /<(script|style|iframe|frame|object|embed|svg|math|form|template|base|meta|link|textarea|button|select)\b|\son\w+=|javascript:|vbscript:|data:text/i;

test('script, style, frames, objects, templates and noscript go away with their content', () => {
    const html = '<p>a</p><script>alert(1)</script><style>p{display:none}</style><iframe src="https://x"></iframe>'
        + '<object data="x"></object><embed src="x"><template><b>t</b></template><noscript><img src=x onerror=alert(1)></noscript>'
        + '<base href="https://evil/"><meta http-equiv="refresh" content="0;url=https://evil/"><link rel="stylesheet" href="x">'
        + '<form action="https://evil/"><input name="q"><button>Go</button><textarea>x</textarea><select><option>o</option></select></form>'
        + '<audio src="x"></audio><video src="x"></video><canvas></canvas><dialog open>d</dialog>';
    assert.equal(clean(html), '<p>a</p>');
});

test('a dropped element inside a kept element goes away, and the text around it stays', () => {
    assert.equal(clean('<p>a<script>b</script>c<ScRiPt>d</ScRiPt>e</p>'), '<p>ace</p>');
    assert.equal(clean('<ul><li>x<svg onload="alert(1)"><a href="javascript:alert(1)">y</a></svg></li></ul>'), '<ul><li>x</li></ul>');
});

test('event handlers, id, name, style, class and unknown attributes go away', () => {
    assert.equal(clean('<p onclick="x" onmouseover="y" id="a" name="b" style="color:red" class="c" data-x="1" title="t">t</p>'), '<p>t</p>');
    assert.equal(clean('<td align="left" colspan="2" rowspan="1" onmouseover="x" background="javascript:x" bgcolor="red">c</td>'),
        'c'); // A td outside a table is text only (the parser drops the tag).
    assert.equal(clean('<table><tr><td align="left" colspan="2" rowspan="1" onmouseover="x" background="javascript:x">c</td></tr></table>'),
        '<table><tbody><tr><td align="left" colspan="2" rowspan="1">c</td></tr></tbody></table>');
});

test('DOM clobbering: no element keeps an id or a name', () => {
    const out = clean('<a id="sanitizeHtml" href="https://x">a</a><img name="location" src="./images/a/b.png"><p id="app">p</p><b name="document">b</b>');
    assert.doesNotMatch(out, /\s(id|name)=/);
});

test('links: only http, https and mailto stay, and web links open outside the app', () => {
    assert.equal(clean('<a href="https://example.com/a?b=1&amp;c=2" title="t" target="_self" rel="opener">x</a>'),
        '<a href="https://example.com/a?b=1&amp;c=2" title="t" target="_blank" rel="noopener noreferrer">x</a>');
    assert.equal(clean('<a href="HTTP://EXAMPLE.COM">x</a>'), '<a href="HTTP://EXAMPLE.COM" target="_blank" rel="noopener noreferrer">x</a>');
    assert.equal(clean('<a href="mailto:a@example.com">m</a>'), '<a href="mailto:a@example.com">m</a>');
    const unsafe = [
        'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
        '&#106;avascript:alert(1)', '&#x6A;avascript:alert(1)', 'jav&#x09;ascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox', 'blob:https://x/1', 'file:///etc/passwd', 'ftp://x', '//evil.example', '#anchor', './page', '/abs', 'page.html', ''
    ];
    for (const href of unsafe) {
        assert.equal(clean(`<a href="${href}">x</a>`), '<a>x</a>', `kept href ${JSON.stringify(href)}`);
    }
});

test('images of the site get data-image-path and no src; other images become a note', () => {
    assert.equal(clean('<img src="./images/blog/p/cat.jpg" alt="Cat" onerror="alert(1)" width="1" srcset="x" loading="lazy">'),
        '<img alt="Cat" data-image-path="src/images/blog/p/cat.jpg">');
    assert.equal(clean('<img src="./images/gallery/g/a%20b.jpg">'), '<img data-image-path="src/images/gallery/g/a b.jpg" alt="">');
    const notes = [
        ['https://evil.example/x.png', 'A'],
        ['data:image/svg+xml,<svg onload=alert(1)/>', ''],
        ['./images/../../.github/x.png', ''],
        ['./images/a%2F..%2Fb.png', ''],
        ['./images//x.png', ''],
        ['./images/./x.png', ''],
        ['./images/%2e%2e/x.png', ''],
        ['images/x.png', ''],
        ['/images/x.png', ''],
        ['./images/%E0%A4%A', ''] // Bad %-sequence: decodeURIComponent throws.
    ];
    for (const [src, alt] of notes) {
        const out = clean(`<img src="${src}" alt="${alt}">`);
        assert.match(out, /^<span class="preview-image">Image: /, `no note for ${src}`);
        assert.doesNotMatch(out, /<img|data-image-path/, `kept an image for ${src}`);
    }
});

test('inputs: only a disabled checkbox stays', () => {
    assert.equal(clean('<input type="checkbox" checked onclick="x"><input type="text" value="x"><input type="image" src="x"><input>'),
        '<input type="checkbox" checked="" disabled="">');
});

test('code keeps only a language-x class', () => {
    assert.equal(clean('<pre><code class="language-js">x</code></pre><code class="btn btn-danger">y</code><code class="language-c++">z</code>'),
        '<pre><code class="language-js">x</code></pre><code>y</code><code>z</code>');
});

test('unknown and other elements are unwrapped: the text stays, the element goes', () => {
    assert.equal(clean('<marquee behavior="x"><b>x</b></marquee><custom-el onclick="y">y</custom-el><section><p>z</p></section><details open><summary>s</summary>c</details>'),
        '<b>x</b>y<p>z</p><details><summary>s</summary>c</details>');
});

test('comments go away, and escaped text stays escaped', () => {
    assert.equal(clean('<!-- c --><p>a &lt;script&gt;alert(1)&lt;/script&gt; b</p><!--[if IE]><script>x</script><![endif]-->'),
        '<p>a &lt;script&gt;alert(1)&lt;/script&gt; b</p>');
});

test('known parser tricks (mXSS, namespace confusion, nesting) give nothing dangerous', () => {
    const payloads = [
        '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
        '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
        '<svg><desc><![CDATA[</desc><script>alert(1)</script>]]></desc></svg>',
        '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
        '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
        '<a href="https://x"><svg><a xlink:href="javascript:alert(1)"><circle r="40"/></a></svg></a>',
        '<p><details open ontoggle="alert(1)"><summary>x</summary></details></p>',
        '<img src="x" onerror="alert(1)" alt="./images/a/b.png">',
        '<a href="https://x" ping="https://evil/"></a>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '<table><td><script>alert(1)</script></td></table>',
        '<xmp><script>alert(1)</script></xmp><plaintext><script>alert(1)</script>',
        '<a href="https:&#x0a;//x" onfocus="alert(1)" autofocus>x</a>',
        '<object data="javascript:alert(1)"><param name="url" value="x"></object>',
        '<div style="background:url(javascript:alert(1))">x</div>',
        '<p><input type="checkbox" onchange="alert(1)" formaction="javascript:alert(1)"></p>',
        '<frameset onload="alert(1)"><frame src="javascript:alert(1)"></frameset>'
    ];
    for (const payload of payloads) {
        const out = clean(payload);
        assert.doesNotMatch(out, DANGEROUS, `dangerous output for ${payload}: ${out}`);
    }
});

test('from Markdown: the renderer and the sanitizer together', () => {
    const md = [
        '# Title',
        '',
        '[safe](https://example.com) [bad](javascript:alert(1)) [rel](./other.md) [anchor](#top)',
        '',
        '![Cat](./images/blog/p/cat.jpg) ![Far](https://evil.example/x.png)',
        '',
        '<img src=x onerror=alert(1)> <script>alert(1)</script> <a href="javascript:alert(1)">x</a>',
        '',
        '- [ ] task',
        '',
        '```js',
        'code',
        '```',
        '',
        '| a | b |',
        '|:--|--:|',
        '| 1 | 2 |'
    ].join('\n');
    const out = clean(marked.parse(md));
    assert.doesNotMatch(out, DANGEROUS);
    assert.match(out, /<h1>Title<\/h1>/);
    assert.match(out, /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">safe<\/a>/);
    assert.match(out, /<a>bad<\/a>/);
    assert.match(out, /<a>rel<\/a>/);
    assert.match(out, /<a>anchor<\/a>/);
    assert.match(out, /<img alt="Cat" data-image-path="src\/images\/blog\/p\/cat\.jpg">/);
    assert.match(out, /<span class="preview-image">Image: Far \(https:\/\/evil\.example\/x\.png\)<\/span>/);
    assert.match(out, /<input[^>]*type="checkbox"[^>]*disabled=""/);
    assert.match(out, /<pre><code class="language-js">code\n<\/code><\/pre>/);
    assert.match(out, /<td align="left">1<\/td>\n<td align="right">2<\/td>/);
});

test('the result is a DocumentFragment with the nodes, not a string', () => {
    const fragment = sanitizeHtml('<p>a</p><p>b</p>');
    assert.equal(fragment.nodeType, 11);
    assert.equal(fragment.childNodes.length, 2);
    assert.equal(fragment.textContent, 'ab');
});
