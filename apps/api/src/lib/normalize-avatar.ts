import sharp from 'sharp';

import { MAX_DECODED_PIXELS } from './image-limits.ts';

const AVATAR_SIZE = 256;

/**
 * What the container is willing to have decoded into memory. Enforced by
 * sniffing the container's own header, not the client-supplied
 * `Content-Type` (multer's `file.mimetype` is whatever the uploader typed
 * into the multipart part, and is never consulted here).
 *
 * SVG is deliberately absent even though sharp will happily rasterize it:
 * it is an XML document handed to librsvg, which can pull in external
 * entities and nest references, and none of that surface buys anything for
 * a 256x256 profile photo.
 */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif']);

/**
 * Normalizes any uploaded or provider-fetched avatar to a fixed-size square
 * webp. This single sharp pass (rotate + resize + re-encode, never
 * `.withMetadata()`) already strips EXIF the same way `stripExif` does, so
 * the avatar path doesn't also call `stripExif` — that would be a second,
 * redundant sharp pass over the same bytes.
 *
 * Unlike `stripExif`, this returns `null` (not the original buffer) on a
 * decode failure: a bad avatar upload must be rejected outright — there's
 * no downstream validator for it the way apps/ai-server validates meal
 * photos.
 *
 * @param imageBytes - The raw uploaded (or provider-fetched) image bytes.
 *   The byte-size cap is the caller's: multer's `limits.fileSize` aborts
 *   the upload mid-stream, so nothing over it ever reaches this function.
 * @returns The normalized webp bytes, or `null` if `imageBytes` isn't a
 *   readable image, isn't one of {@link ALLOWED_FORMATS}, or would decode
 *   to more than {@link MAX_DECODED_PIXELS}.
 */
export async function normalizeAvatar(imageBytes: Buffer): Promise<Buffer | null> {
    try {
        const image = sharp(imageBytes, { limitInputPixels: MAX_DECODED_PIXELS });
        const { format } = await image.metadata();
        if (format === undefined || !ALLOWED_FORMATS.has(format)) {
            return null;
        }
        return await image
            .rotate()
            .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        return null;
    }
}
