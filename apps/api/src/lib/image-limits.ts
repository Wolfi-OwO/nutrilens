/**
 * The decoded-pixel ceiling handed to every `sharp()` call in this app.
 *
 * A compression bomb is small on the wire and enormous in memory: a
 * ~1MB PNG of a single flat colour decodes to whatever dimensions its
 * header claims, and sharp's own default cap (0x3FFF x 0x3FFF ≈ 268
 * megapixels) is around a gigabyte of RGBA — more than the container has,
 * so one upload could take the process down. Neither upload route's byte
 * limit (2MB for an avatar, 10MB for a meal photo) constrains this at all,
 * because the ratio is the attack.
 *
 * 40 megapixels is comfortably past any real phone camera (a 48MP sensor
 * writes ~12MP by default; the largest common full-frame stills are ~60MP
 * and would be rejected — acceptable for a 256x256 avatar and for a photo
 * that apps/ai-server downscales anyway).
 */
export const MAX_DECODED_PIXELS = 40_000_000;
