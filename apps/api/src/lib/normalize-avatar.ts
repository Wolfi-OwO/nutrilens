import sharp from 'sharp';

const AVATAR_SIZE = 256;

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
 * @returns The normalized webp bytes, or `null` if `imageBytes` isn't a
 *   readable image.
 */
export async function normalizeAvatar(imageBytes: Buffer): Promise<Buffer | null> {
    try {
        return await sharp(imageBytes)
            .rotate()
            .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        return null;
    }
}
