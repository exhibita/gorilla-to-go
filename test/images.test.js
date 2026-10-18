import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    imageFolder, imageName, markdownPath, repoImagePath, fitSize, markdownImage, referencedImages, namesInText, MAX_WIDTH
} from '../app/js/images.js';

test('imageFolder puts the images of a page in src/images/<type>/<slug>/ (mvp-plan section 7)', () => {
    assert.equal(imageFolder('src/blog/my-post/index.md'), 'src/images/blog/my-post/');
    assert.equal(imageFolder('src/gallery/trip/index.md'), 'src/images/gallery/trip/');
    assert.equal(imageFolder('src/about/index.md'), 'src/images/page/about/');
    assert.equal(imageFolder('src/products/software/index.md'), 'src/images/page/products/software/');
    assert.equal(imageFolder('src/index.md'), 'src/images/page/index/');
});

test('markdownPath and repoImagePath convert between the repository and the ./images/ path (decision 21)', () => {
    assert.equal(markdownPath('src/images/blog/my-post/cat.jpg'), './images/blog/my-post/cat.jpg');
    assert.equal(repoImagePath('./images/blog/my-post/cat.jpg'), 'src/images/blog/my-post/cat.jpg');
    assert.equal(repoImagePath('./images/blog/my%20post/a%20b.jpg'), 'src/images/blog/my post/a b.jpg', 'marked encodes spaces');
    assert.equal(repoImagePath('https://example.com/cat.jpg'), null);
    assert.equal(repoImagePath('/images/cat.jpg'), null);
    assert.equal(repoImagePath('./css/site.css'), null);
    assert.equal(repoImagePath('./images/../.github/x'), null, 'no way out of the images folder');
    assert.equal(repoImagePath('./images/%E0%A4%A'), null, 'a bad escape does not throw');
});

test('imageName makes a safe file name from the name of the photo', () => {
    assert.equal(imageName('IMG_2041.JPG', 'jpg', []), 'img-2041.jpg');
    assert.equal(imageName('Café au lait.heic', 'jpg', []), 'cafe-au-lait.jpg', 'the extension is the one of the new copy');
    assert.equal(imageName('Screenshot 2026-10-18 at 9.15.png', 'png', []), 'screenshot-2026-10-18-at-9-15.png');
    assert.equal(imageName('🦍.jpg', 'jpg', []), 'image.jpg');
    assert.equal(imageName('', 'jpg', []), 'image.jpg');
    assert.ok(imageName(`${'long '.repeat(30)}.jpg`, 'jpg', []).length <= 44);
});

test('imageName adds -2, -3 when the name is taken (letter case does not matter)', () => {
    assert.equal(imageName('cat.jpg', 'jpg', ['cat.jpg']), 'cat-2.jpg');
    assert.equal(imageName('cat.jpg', 'jpg', ['CAT.jpg', 'cat-2.jpg']), 'cat-3.jpg');
    assert.equal(imageName('cat.jpg', 'png', ['cat.jpg']), 'cat.png');
});

test('namesInText finds the file names that the page uses in an image folder', () => {
    const text = '![a](./images/blog/p/cat.jpg)\n<img src="./images/blog/p/dog-2.png">\n![x](./images/blog/other/bird.jpg)';
    assert.deepEqual(namesInText(text, 'src/images/blog/p/'), ['cat.jpg', 'dog-2.png']);
});

test('fitSize makes a photo at most 1600 px wide and keeps the aspect ratio', () => {
    assert.equal(MAX_WIDTH, 1600);
    assert.deepEqual(fitSize(4032, 3024), { width: 1600, height: 1200 });
    assert.deepEqual(fitSize(3024, 4032), { width: 1600, height: 2133 });
    assert.deepEqual(fitSize(800, 600), { width: 800, height: 600 }, 'never larger');
    assert.deepEqual(fitSize(5000, 1), { width: 1600, height: 1 }, 'at least 1 px');
});

test('markdownImage writes ![alt](path) and escapes the alt text', () => {
    assert.equal(markdownImage('A cat', './images/blog/p/cat.jpg'), '![A cat](./images/blog/p/cat.jpg)');
    assert.equal(markdownImage('The [big] cat\\dog', './x.jpg'), '![The \\[big\\] cat\\\\dog](./x.jpg)');
    assert.equal(markdownImage('  two\nlines  ', './x.jpg'), '![two lines](./x.jpg)');
    assert.equal(markdownImage('', './x.jpg'), '![](./x.jpg)');
});

test('referencedImages keeps only the images that the text still uses', () => {
    const images = [
        { path: 'src/images/blog/p/cat.jpg' },
        { path: 'src/images/blog/p/cat.jpg2' },
        { path: 'src/images/blog/p/dog.jpg' }
    ];
    const text = 'Hello\n![A cat](./images/blog/p/cat.jpg)\n';
    assert.deepEqual(referencedImages(text, images).map(i => i.path), ['src/images/blog/p/cat.jpg']);
    assert.deepEqual(referencedImages('<img src="./images/blog/p/dog.jpg" alt="">', images).map(i => i.path), ['src/images/blog/p/dog.jpg']);
    assert.deepEqual(referencedImages('', images), []);
});
