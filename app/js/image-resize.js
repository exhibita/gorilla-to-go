// Make a photo ready for the site (mvp-plan section 7): at most MAX_WIDTH wide, and always a new copy.
// The new copy has no EXIF data, so no GPS location of the phone goes to the public repository.
// Browser only (canvas): the size rules are in images.js and run in tests.
import { fitSize } from './images.js';
import { bytesToBase64 } from './github.js';

const JPEG_QUALITY = 0.85;

export class ImageError extends Error {}

// Decode the photo upright (the EXIF rotation applies). Older browsers do not know the option.
async function decode(file) {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
        if (!(err instanceof TypeError)) throw err;
        return createImageBitmap(file);
    }
}

// Returns { base64, mimeType, extension, width, height, size }. Throws ImageError with a message for the user.
export async function prepareImage(file) {
    const type = String(file.type).toLowerCase();
    if (type === 'image/gif') throw new ImageError('The app cannot add GIF images, because an animation stops. Use a JPEG or PNG.');
    if (type === 'image/svg+xml' || /\.svg$/i.test(file.name)) throw new ImageError('The app cannot add SVG images. Use a JPEG or PNG.');

    let bitmap;
    try {
        bitmap = await decode(file);
    } catch {
        throw new ImageError('This image format is not supported. Use a JPEG or PNG.');
    }
    const canvas = document.createElement('canvas');
    try {
        const { width, height } = fitSize(bitmap.width, bitmap.height);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new ImageError('The app cannot make a copy of this image. Close and open the app, then try again.');
        const png = type === 'image/png';
        if (!png) {
            // JPEG has no transparency: a transparent part becomes white, not black.
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
        }
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', JPEG_QUALITY));
        // No blob: the canvas was too large for the device (for example a very long panorama).
        if (!blob) throw new ImageError('The app cannot make a copy of this image. Use a smaller image.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return { base64: bytesToBase64(bytes), mimeType: blob.type, extension: png ? 'png' : 'jpg', width, height, size: bytes.length };
    } finally {
        bitmap.close?.();
        // Free the canvas memory at once: iOS has a small limit for all canvases together.
        canvas.width = 0;
        canvas.height = 0;
    }
}
