import sharp from 'sharp';

import { MAX_DECODED_PIXELS } from './image-limits.ts';

/**
 * Re-encodes an image buffer, discarding EXIF/IPTC/XMP metadata — a phone
 * photo's EXIF commonly carries GPS coordinates (NFR-SEC-06). `sharp` drops
 * all metadata by default unless `.withMetadata()` is called, which this
 * deliberately never does.
 *
 * Runs before the photo leaves apps/api toward apps/ai-server — even though
 * ai-server persists nothing (NFR-SEC-02), the NFR draws the boundary at
 * apps/api specifically, so a photo's location never crosses a process
 * boundary at all, not even transiently.
 *
 * Falls back to the original buffer on a decode failure — malformed-image
 * rejection is `apps/ai-server`'s job (`preprocess_image`, a 400 there);
 * this function only strips metadata for images it can actually read. A
 * compression bomb now takes that same path: `MAX_DECODED_PIXELS` makes
 * sharp throw instead of allocating, so the bomb is forwarded unexpanded
 * for ai-server to reject rather than decoded here.
 *
 * @param imageBytes - The raw uploaded photo bytes.
 * @returns The re-encoded bytes without metadata, or `imageBytes` unchanged
 *   if it couldn't be decoded within the limits above.
 */
export async function stripExif(imageBytes: Buffer): Promise<Buffer> {
    try {
        return await sharp(imageBytes, { limitInputPixels: MAX_DECODED_PIXELS }).rotate().toBuffer();
    } catch {
        return imageBytes;
    }
}
