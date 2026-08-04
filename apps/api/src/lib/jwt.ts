import jwt from 'jsonwebtoken';

import { config } from '../config/index.ts';

/** A registered account role, as embedded in an {@link AccessTokenPayload}. */
export type Role = 'user' | 'coach' | 'admin';

const ROLES: readonly Role[] = ['user', 'coach', 'admin'];

/** The claims carried in every session token this API issues. */
export interface AccessTokenPayload {
    /** The subject — the authenticated user's id. */
    sub: string;
    role: Role;
}

/**
 * Signs a session token for an authenticated user.
 *
 * @param payload - The claims to embed (user id and role).
 * @returns A signed JWT, expiring after `config.jwtExpiresIn`.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
    // config.jwtSecret is validated non-empty by validateConfig() at boot,
    // before this can be called from a real request. The expiresIn cast
    // (rather than a plain `string`) is needed because jsonwebtoken's type
    // only accepts its own StringValue literal union, not an arbitrary
    // string — exactOptionalPropertyTypes then requires NonNullable here,
    // since the option is genuinely always set, never `undefined`.
    return jwt.sign(payload, config.jwtSecret as string, {
        expiresIn: config.jwtExpiresIn as NonNullable<jwt.SignOptions['expiresIn']>,
    });
}

/**
 * Verifies a session token's signature and expiry, and returns its claims.
 *
 * @param token - The raw JWT, without the `Bearer ` prefix.
 * @returns The decoded, validated claims.
 * @throws {Error} (from `jsonwebtoken`) if the signature is invalid or the
 *   token has expired; a plain `Error` if the payload doesn't carry the
 *   shape this API issues (e.g. a token signed for something else with the
 *   same secret).
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, config.jwtSecret as string);

    if (
        typeof decoded === 'string' ||
        typeof decoded.sub !== 'string' ||
        !ROLES.includes(decoded.role as Role)
    ) {
        throw new Error('Token payload is not a valid access token.');
    }

    return { sub: decoded.sub, role: decoded.role as Role };
}
