import jwt from 'jsonwebtoken';

import { config } from '../config/index.ts';

/** The claims carried in every session token this API issues. */
export interface AccessTokenPayload {
    /** The subject — the authenticated user's id. */
    sub: string;
    role: 'user' | 'coach' | 'admin';
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
