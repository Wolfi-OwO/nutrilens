import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

import { config } from '../config/index.ts';

// RFC 6238 time-based one-time passwords, written against node:crypto so the
// authentication path carries no extra dependency. Parameters are the ones every
// authenticator app assumes: HMAC-SHA1, 6 digits, 30 second step.
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** Codes from one step either side are accepted, to absorb clock drift. */
const WINDOW = 1;

/** @returns A fresh 160-bit secret, base32-encoded for the authenticator app. */
export function generateSecret(): string {
    return base32Encode(randomBytes(20));
}

function base32Encode(bytes: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(text: string): Buffer {
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of text.toUpperCase().replace(/=+$/, '')) {
        const index = BASE32.indexOf(char);
        if (index === -1) throw new Error('Invalid base32 secret.');
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/**
 * @param secret - The base32 secret.
 * @param counter - The time-step counter.
 * @returns The 6-digit code for that counter, zero-padded.
 */
export function hotp(secret: string, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', base32Decode(secret)).update(message).digest();
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const binary =
        (((digest[offset] ?? 0) & 0x7f) << 24) |
        (((digest[offset + 1] ?? 0) & 0xff) << 16) |
        (((digest[offset + 2] ?? 0) & 0xff) << 8) |
        ((digest[offset + 3] ?? 0) & 0xff);
    return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * @param secret - The base32 secret.
 * @param code - What the user typed.
 * @param now - Epoch milliseconds; a parameter so tests can pin the clock.
 * @returns Whether the code is valid within the drift window.
 */
export function verifyTotp(secret: string, code: string, now: number = Date.now()): boolean {
    const clean = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(clean)) return false;
    const counter = Math.floor(now / 1000 / STEP_SECONDS);
    let matched = false;
    // No early return: every step is compared so timing does not reveal which one matched.
    for (let drift = -WINDOW; drift <= WINDOW; drift += 1) {
        const expected = Buffer.from(hotp(secret, counter + drift));
        if (timingSafeEqual(expected, Buffer.from(clean))) matched = true;
    }
    return matched;
}

/**
 * @param secret - The base32 secret.
 * @param email - The account label shown in the app.
 * @returns The otpauth:// URI an authenticator app imports (usually via QR).
 */
export function otpauthUri(secret: string, email: string): string {
    const label = encodeURIComponent(`NutriLens:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=NutriLens&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** @returns Ten single-use recovery codes, shaped xxxxx-xxxxx. */
export function generateRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => {
        const raw = randomBytes(5).toString('hex');
        return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
}

/**
 * @param code - A recovery code as typed.
 * @returns Its hash, which is all that is stored.
 */
export function hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

// The secret is encrypted at rest. TOTP_ENCRYPTION_KEY (any string) is preferred so
// that rotating JWT_SECRET does not lock every 2FA user out; without it the key is
// derived from JWT_SECRET.
function encryptionKey(): Buffer {
    const source = process.env.TOTP_ENCRYPTION_KEY ?? config.jwtSecret ?? '';
    return Buffer.from(hkdfSync('sha256', source, 'nutrilens-totp', 'secret-encryption', 32));
}

/**
 * @param secret - The clear base32 secret.
 * @returns iv.tag.ciphertext, base64url, for the database.
 */
export function encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

/**
 * @param stored - What {@link encryptSecret} returned.
 * @returns The clear base32 secret.
 */
export function decryptSecret(stored: string): string {
    const [iv, tag, body] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !body) throw new Error('Malformed stored secret.');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
