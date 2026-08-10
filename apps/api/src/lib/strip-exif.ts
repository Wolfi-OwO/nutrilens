import sharp from 'sharp';

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
 * this function only strips metadata for images it can actually read.
 */
export async function stripExif(imageBytes: Buffer): Promise<Buffer> {
    try {
        return await sharp(imageBytes).rotate().toBuffer();
    } catch {
        return imageBytes;
    }
}
