import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImages } from '../app/js/frontmatter-write.js';
import { parseFrontmatter } from '../app/js/frontmatter.js';
import { galleryItems, galleryImagePath, moveItem } from '../app/js/images.js';

const parse = raw => parseFrontmatter(`---\n${raw}\n---\n`);

const RAW = [
    'title: Earthy',
    '# The photos',
    'images:',
    '  - path: ./images/gallery/a.png',
    '    alt: Hills',
    '    caption: Sage Horizon',
    '',
    '  - path: ./images/gallery/b.png',
    '    caption: Dunes',
    'skeleton: gallery'
].join('\n');

test('setImages leaves the text exactly as it is when the list did not change', () => {
    assert.equal(setImages(RAW, galleryItems(parse(RAW).data)), RAW);
});

test('setImages changes only the images block, and the parser reads the new list back', () => {
    const items = galleryItems(parse(RAW).data);
    const changed = setImages(RAW, [items[1], { path: './images/gallery/x/new.jpg', alt: 'A "new" photo: yes', caption: '' }]);
    assert.equal(changed, [
        'title: Earthy',
        '# The photos',
        'images:',
        '  - path: ./images/gallery/b.png',
        '    caption: "Dunes"',
        '  - path: ./images/gallery/x/new.jpg',
        '    alt: "A \\"new\\" photo: yes"',
        'skeleton: gallery'
    ].join('\n'));
    const { data, error } = parse(changed);
    assert.equal(error, null);
    assert.deepEqual(data.images, [
        { path: './images/gallery/b.png', caption: 'Dunes' },
        { path: './images/gallery/x/new.jpg', alt: 'A "new" photo: yes' }
    ]);
});

test('setImages replaces a list at column 0 and keeps the keys after it', () => {
    const raw = 'images:\n- path: ./images/a.jpg\n  alt: A\nskeleton: gallery';
    assert.equal(setImages(raw, [{ path: './images/b.jpg', alt: 'B' }]), 'images:\n  - path: ./images/b.jpg\n    alt: "B"\nskeleton: gallery');
});

test('setImages keeps other keys of an item, and items that are not maps', () => {
    const raw = 'images:\n  - path: ./images/a.jpg\n    width: 800\n    featured: true\n  - just text';
    const items = galleryItems(parse(raw).data);
    const changed = setImages(raw, [items[1], items[0]]);
    assert.deepEqual(parse(changed).data.images, ['just text', { path: './images/a.jpg', width: 800, featured: true }]);
});

test('setImages adds the key when there is none, and writes an empty key for no photos', () => {
    assert.equal(setImages('title: T\nskeleton: gallery', [{ path: './images/a.jpg' }]), 'title: T\nskeleton: gallery\nimages:\n  - path: ./images/a.jpg');
    assert.equal(setImages('title: T', []), 'title: T', 'no key and no photos: no change');
    assert.equal(setImages('images:\n  - path: ./images/a.jpg\ntitle: T', []), 'images:\ntitle: T');
    assert.equal(setImages('', [{ path: './images/a.jpg' }]), 'images:\n  - path: ./images/a.jpg');
});

test('setImages quotes a path that plain YAML cannot hold', () => {
    const changed = setImages('', [{ path: './images/my photo #1.jpg' }]);
    assert.equal(changed, 'images:\n  - path: "./images/my photo #1.jpg"');
    assert.equal(parse(changed).data.images[0].path, './images/my photo #1.jpg');
});

test('setImages quotes a path that plain YAML would read as another type', () => {
    for (const path of ['true', 'null', '1e3', '2024-01-01', '.inf']) {
        const changed = setImages('', [{ path }]);
        assert.equal(parse(changed).data.images[0].path, path, path);
    }
});

test('setImages keeps a comment after the last item', () => {
    const raw = 'images:\n  - path: ./images/a.jpg\n  # About the cover:\ncover: ./images/b.jpg';
    assert.equal(setImages(raw, [{ path: './images/c.jpg' }]), 'images:\n  - path: ./images/c.jpg\n  # About the cover:\ncover: ./images/b.jpg');
});

test('galleryItems gives a copy of the list, and an empty list for no list', () => {
    const data = { images: [{ path: './a.jpg', alt: 'A' }] };
    const items = galleryItems(data);
    items[0].alt = 'changed';
    assert.equal(data.images[0].alt, 'A');
    assert.deepEqual(galleryItems({}), []);
    assert.deepEqual(galleryItems({ images: null }), []);
    assert.deepEqual(galleryItems({ images: 'text' }), []);
});

test('galleryImagePath finds the repository file as the build does', () => {
    assert.equal(galleryImagePath('./images/gallery/a.png'), 'src/images/gallery/a.png');
    assert.equal(galleryImagePath('images/gallery/a.png'), 'src/images/gallery/a.png', 'the build adds ./');
    assert.equal(galleryImagePath('https://example.com/a.png'), null);
    assert.equal(galleryImagePath('../a.png'), null);
    assert.equal(galleryImagePath(42), null);
});

test('moveItem moves one item and keeps the others in order', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c'], 'outside the list: no change');
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 3), ['a', 'b', 'c']);
});
