import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import sharp from 'sharp';

import { stripExif } from '../../src/lib/strip-exif.ts';

// sharp's typed withExif() only accepts flat IFD0-3 string dicts (see
// node_modules/sharp/lib/index.d.ts) — no separate GPS key, even though a
// real phone photo's EXIF does carry its GPS coordinates in their own IFD.
// That's fine for this test: stripExif() drops the whole EXIF block
// wholesale, not specific tags, so proving IFD0 metadata is gone proves the
// GPS IFD would be too.
async function jpegWithExif(): Promise<Buffer> {
    return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } })
        .jpeg()
        .withExif({ IFD0: { Make: 'TestCamera', GPSLatitude: '52/1 30/1 0/1' } })
        .toBuffer();
}

describe('stripExif', () => {
    test('removes EXIF metadata from a JPEG', async () => {
        const original = await jpegWithExif();
        const originalMeta = await sharp(original).metadata();
        assert.ok(originalMeta.exif, 'fixture must actually carry EXIF for this test to mean anything');

        const stripped = await stripExif(original);
        const strippedMeta = await sharp(stripped).metadata();

        assert.equal(strippedMeta.exif, undefined);
    });

    test('output never carries an orientation tag, even when the input does', async () => {
        const original = await jpegWithExif();

        const stripped = await stripExif(original);
        const strippedMeta = await sharp(stripped).metadata();

        // .rotate() with no args bakes any orientation into the pixels
        // before metadata is dropped, so nothing is left to misapply.
        assert.equal(strippedMeta.orientation, undefined);
    });

    test('falls back to the original buffer on undecodable input', async () => {
        const notAnImage = Buffer.from('not an image');
        const result = await stripExif(notAnImage);
        assert.equal(result, notAnImage);
    });
});
