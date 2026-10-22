// The look of a site for the editor Preview: colours, fonts and the radius from the site's
// src/css/style.css, without network, DOM or storage, so it runs in tests.
// The app cannot load the site stylesheet (the CSP allows only the app styles), so it reads the values
// and the Preview uses them as CSS custom properties. The rules of the site come first (body, h1, a,
// .link-button, .btn-primary), then the token names of the template and of other sites, then the
// template look. Each value is checked: only plain colours, lengths and font names are kept.

// The template look (vanilla-gorilla src/css/style.css). Also the look before the app read the site.
export const TEMPLATE_LOOK = Object.freeze({
    bg: '#f8f6f2',
    surface: '#ffffff',
    text: '#2b2927',
    heading: '#2b2927',
    muted: '#66615c',
    link: '#596e57',
    button: '#596e57',
    buttonText: '#ffffff',
    buttonBorder: '#596e57',
    border: '#e3dcd0',
    radius: '12px',
    fontBody: "'Outfit', sans-serif",
    fontHeading: "'Playfair Display', serif"
});

export const LOOK_KEYS = Object.keys(TEMPLATE_LOOK);

const MAX_VALUE_LENGTH = 200;
const NOT_A_COLOUR = new Set(['inherit', 'initial', 'unset', 'revert', 'currentcolor', 'none', 'auto']);

const isColour = value => value.length <= MAX_VALUE_LENGTH && (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ||
    /^(?:rgba?|hsla?)\(\s*[\d.,%\s/+-]+(?:deg)?[\d.,%\s/+-]*\)$/i.test(value) ||
    (/^[a-z]+$/i.test(value) && !NOT_A_COLOUR.has(value.toLowerCase())));
const isLength = value => /^(?:0|\d*\.?\d+(?:px|rem|em|%))$/.test(value);
const FONT_NAME = /^(?:"[^"\\]*"|'[^'\\]*'|-?[a-z][\w-]*(?:\s+-?[a-z][\w-]*)*)$/i;
const isFont = value => value.length <= MAX_VALUE_LENGTH && value.split(',').every(name => FONT_NAME.test(name.trim()));

// The top-level rules: [{ selectors, declarations }]. Rules inside @media and other @ blocks do not count.
function topLevelRules(css) {
    const rules = [];
    let depth = 0;
    let start = 0;
    let selector = '';
    let bodyStart = 0;
    for (let i = 0; i < css.length; i++) {
        const char = css[i];
        if (char === '{') {
            if (depth === 0) {
                selector = css.slice(start, i).trim();
                bodyStart = i + 1;
            }
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0 && !selector.startsWith('@')) {
                rules.push({ selectors: selector.split(',').map(part => part.trim()), declarations: declarationsOf(css.slice(bodyStart, i)) });
            }
            if (depth <= 0) {
                depth = 0;
                start = i + 1;
            }
        } else if (char === ';' && depth === 0) {
            start = i + 1; // For example an @import line.
        }
    }
    return rules;
}

// "color: red; font-family: 'A', serif" → Map { color → red, font-family → 'A', serif }. The first one counts.
function declarationsOf(text) {
    const declarations = new Map();
    for (const part of text.split(';')) {
        const colon = part.indexOf(':');
        if (colon === -1) continue;
        const property = part.slice(0, colon).trim();
        if (property && !declarations.has(property.toLowerCase())) declarations.set(property.startsWith('--') ? property : property.toLowerCase(), part.slice(colon + 1).trim());
    }
    return declarations;
}

// The value with each var(--x) or var(--x, fallback) replaced, or null when a token is missing.
function resolve(value, tokens, depth = 0) {
    if (value == null || depth > 5) return null;
    const match = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/);
    if (!match) return value.trim();
    const replacement = tokens.has(match[1]) ? resolve(tokens.get(match[1]), tokens, depth + 1) : resolve(match[2], tokens, depth + 1);
    if (replacement == null) return null;
    return resolve(value.slice(0, match.index) + replacement + value.slice(match.index + match[0].length), tokens, depth + 1);
}

// The relative luminance of a #hex or rgb() colour, or null.
function luminance(colour) {
    let rgb;
    const hex = colour.match(/^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{0,2})$/i);
    if (hex) {
        const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d) : hex[1].match(/../g);
        rgb = digits.map(d => parseInt(d, 16));
    } else {
        const numbers = colour.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
        if (!numbers) return null;
        rgb = numbers.slice(1, 4).map(Number);
    }
    const [r, g, b] = rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// White or near-black text, whichever contrasts more with the background.
function contrastText(background) {
    const l = luminance(background);
    if (l === null) return '#ffffff';
    return (1.05 / (l + 0.05)) >= ((l + 0.05) / (0.0144 + 0.05)) ? '#ffffff' : '#111111';
}

// The look of a site from the text of its stylesheet. Every key of TEMPLATE_LOOK always has a value.
export function siteLook(cssText) {
    const css = String(cssText ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = topLevelRules(css);
    const tokens = new Map();
    for (const rule of rules.filter(r => r.selectors.includes(':root'))) {
        for (const [name, value] of rule.declarations) if (name.startsWith('--') && !tokens.has(name)) tokens.set(name, value);
    }
    if (!tokens.size && !rules.length) return { ...TEMPLATE_LOOK };

    const ruleFor = selector => rules.find(rule => rule.selectors.includes(selector))?.declarations;
    const fromRule = (declarations, properties, check) => {
        for (const property of properties) {
            const value = resolve(declarations?.get(property), tokens);
            if (value && check(value)) return value;
        }
        return null;
    };
    const fromTokens = (names, check) => {
        for (const name of names) {
            const value = resolve(tokens.get(name), tokens);
            if (value && check(value)) return value;
        }
        return null;
    };

    const body = ruleFor('body');
    const h1 = ruleFor('h1');
    const a = ruleFor('a');
    const bg = fromRule(body, ['background-color', 'background'], isColour) ?? fromTokens(['--bg-primary', '--bg'], isColour) ?? TEMPLATE_LOOK.bg;
    const text = fromRule(body, ['color'], isColour) ?? fromTokens(['--text-body', '--text-main', '--text-primary'], isColour) ?? TEMPLATE_LOOK.text;
    // A link with "color: inherit" has the text colour.
    const linkValue = resolve(a?.get('color'), tokens);
    const link = (linkValue && NOT_A_COLOUR.has(linkValue.toLowerCase()) ? text : null) ??
        (linkValue && isColour(linkValue) ? linkValue : null) ??
        fromTokens(['--color-primary', '--accent-gold', '--bg-ink'], isColour) ?? TEMPLATE_LOOK.link;

    // The button colours come as a pair: from one rule, from the tokens, or from the template.
    let button = null;
    let buttonText = null;
    let buttonRule = null;
    for (const selector of ['.link-button', '.btn-primary']) {
        const declarations = ruleFor(selector);
        button = fromRule(declarations, ['background-color', 'background'], isColour);
        if (button) {
            buttonRule = declarations;
            buttonText = fromRule(declarations, ['color'], isColour);
            break;
        }
    }
    if (!button) {
        button = fromTokens(['--color-primary', '--accent-gold', '--bg-ink'], isColour);
        // --text-light is white text only in the template family: other sites use the name for grey text.
        if (button && tokens.has('--color-primary')) buttonText = fromTokens(['--text-light'], isColour);
    }
    if (button && !buttonText) buttonText = contrastText(button);
    const borderValue = resolve(buttonRule?.get('border-color') ?? buttonRule?.get('border'), tokens)?.split(/\s+/).at(-1);

    return {
        bg,
        surface: fromTokens(['--surface'], isColour) ?? 'transparent', // No surface: the content is on the background.
        text,
        heading: fromRule(h1, ['color'], isColour) ?? text,
        muted: fromTokens(['--text-muted', '--text-secondary', '--text-faint'], isColour) ?? TEMPLATE_LOOK.muted,
        link,
        button: button ?? TEMPLATE_LOOK.button,
        buttonText: button ? buttonText : TEMPLATE_LOOK.buttonText,
        buttonBorder: button ? (borderValue && isColour(borderValue) ? borderValue : button) : TEMPLATE_LOOK.buttonBorder,
        border: fromTokens(['--surface-border', '--line', '--border'], isColour) ?? TEMPLATE_LOOK.border,
        radius: fromRule(ruleFor('.link-button'), ['border-radius'], isLength) ?? fromTokens(['--radius-md', '--radius'], isLength) ?? TEMPLATE_LOOK.radius,
        fontBody: fromRule(body, ['font-family'], isFont) ?? fromTokens(['--font-sans', '--font-body'], isFont) ?? TEMPLATE_LOOK.fontBody,
        fontHeading: fromRule(h1, ['font-family'], isFont) ?? fromTokens(['--font-serif', '--font-title', '--font-heading'], isFont) ?? TEMPLATE_LOOK.fontHeading
    };
}
