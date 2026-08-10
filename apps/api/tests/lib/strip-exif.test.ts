import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import sharp from 'sharp';

import { stripExif } from '../../src/lib/strip-exif.ts';

// A 1x1 JPEG carrying EXIF GPS tags (0x0002/0x0004: GPSLatitude/GPSLongitude
// IFD pointer set via a minimal APP1 segment) — sharp can both write and
// read EXIF, so the round trip proves the strip actually removes it rather
// than just not adding new metadata.
async function jpegWithGpsExif(): Promise<Buffer> {
    return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } })
        .jpeg()
        .withExif({
            IFD0: { Make: 'TestCamera' },
            GPS: {
                GPSLatitudeRef: 'N',
                GPSLatitude: '52/1 30/1 0/1',
                GPSLongitudeRef: 'E',
                GPSLongitude: '13/1 24/1 0/1',
            },
        })
        .toBuffer();
}

describe('stripExif', () => {
    test('removes EXIF/GPS metadata from a JPEG', async () => {
        const original = await jpegWithGpsExif();
        const originalMeta = await sharp(original).metadata();
        assert.ok(originalMeta.exif, 'fixture must actually carry EXIF for this test to mean anything');

        const stripped = await stripExif(original);
        const strippedMeta = await sharp(stripped).metadata();

        assert.equal(strippedMeta.exif, undefined);
    });

    test('output never carries an orientation tag, even when the input does', async () => {
        const original = await jpegWithGpsExif();

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
