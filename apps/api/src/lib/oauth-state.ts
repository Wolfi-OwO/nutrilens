// The `state` parameter OAuth's Authorization Code flow requires for CSRF
// protection (RFC 6749 §10.12) — without it, an attacker can trick a
// victim's browser into completing an OAuth flow the attacker initiated,
// linking the attacker's provider account to the victim's session. Signed
// with the same JWT secret as access tokens but a distinct, short expiry and
// its own `purpose` claim, so a state token can never be replayed as (or
// confused with) a real session token even though they share a signer.

import jwt from 'jsonwebtoken';

import { config } from '../config/index.ts';
import type { OAuthProviderName } from '../models/auth-provider.model.ts';

const STATE_EXPIRES_IN = '10m'; // generous enough for a slow provider login, short enough to limit replay

/** Pinned for the same reason lib/jwt.ts pins it — see the note there. */
const ALGORITHM = 'HS256';

interface OAuthStatePayload {
    purpose: 'oauth_state';
    provider: OAuthProviderName;
}

export function signOAuthState(provider: OAuthProviderName): string {
    return jwt.sign({ purpose: 'oauth_state', provider } satisfies OAuthStatePayload, config.jwtSecret as string, {
        algorithm: ALGORITHM,
        expiresIn: STATE_EXPIRES_IN,
    });
}

/**
 * @param state - The raw `state` query parameter from the callback request.
 * @param expectedProvider - The provider named in the callback URL itself
 *   (`:provider` route param) — must match what's embedded in the state, so
 *   a state minted for `github` can't be replayed against `/auth/google/callback`.
 * @returns Nothing on success.
 * @throws {Error} If the state is missing, expired, malformed, or was
 *   minted for a different provider.
 */
export function verifyOAuthState(state: string | undefined, expectedProvider: OAuthProviderName): void {
    if (!state) {
        throw new Error('Missing OAuth state parameter.');
    }
    const decoded = jwt.verify(state, config.jwtSecret as string, { algorithms: [ALGORITHM] });
    if (
        typeof decoded === 'string' ||
        decoded.purpose !== 'oauth_state' ||
        decoded.provider !== expectedProvider
    ) {
        throw new Error('OAuth state does not match the expected provider.');
    }
}
