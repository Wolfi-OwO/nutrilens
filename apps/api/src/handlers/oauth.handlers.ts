import type { Request, Response } from 'express';

import { config } from '../config/index.ts';
import { signAccessToken } from '../lib/jwt.ts';
import { BadRequestError, NotFoundError } from '../lib/errors.ts';
import { buildAuthorizeUrl, getProvider, isProviderConfigured } from '../lib/oauth-providers.ts';
import { signOAuthState, verifyOAuthState } from '../lib/oauth-state.ts';
import type { OAuthProviderName } from '../models/auth-provider.model.ts';
import type { OAuthService } from '../services/oauth-service.ts';

const PROVIDER_NAMES: readonly OAuthProviderName[] = ['github', 'google', 'microsoft'];

function parseProvider(raw: string): OAuthProviderName {
    if (!PROVIDER_NAMES.includes(raw as OAuthProviderName)) {
        throw new NotFoundError(`Unknown provider "${raw}".`);
    }
    const provider = raw as OAuthProviderName;
    if (!isProviderConfigured(provider)) {
        throw new NotFoundError(`"${provider}" login is not configured on this deployment.`);
    }
    return provider;
}

function callbackUrl(req: Request, provider: OAuthProviderName): string {
    // Built from the request itself (not a hardcoded prod URL) so this
    // works unmodified against production, every test revision's own FQDN,
    // and local dev — the provider app registration allow-lists every
    // callback URL it needs to accept, so a redirect_uri built from
    // whatever host actually served the request is safe, not a
    // host-header-injection risk (Express's req.protocol/get('host') for a
    // request that reached this internal-only-network-adjacent app already
    // passed through Azure's own ingress, which sets these from the real
    // edge, not raw client input).
    return `${req.protocol}://${req.get('host')}/auth/${provider}/callback`;
}

/**
 * `GET /auth/:provider` — redirects the browser to the provider's own
 * authorize page. The `state` param (short-lived signed JWT) is this
 * request's CSRF protection; the provider round-trips it back to the
 * callback unchanged.
 */
export function oauthStartHandler() {
    return function oauthStart(req: Request, res: Response): void {
        const provider = parseProvider(req.params.provider ?? '');
        const state = signOAuthState(provider);
        const url = buildAuthorizeUrl(provider, callbackUrl(req, provider), state);
        res.redirect(url);
    };
}

/**
 * `GET /auth/:provider/callback` — exchanges the authorization code,
 * resolves the caller to a nutrilens account (via `OAuthService`), and
 * hands the browser a session token by redirecting to the frontend with the
 * token in the URL **fragment**, not a query param — a fragment is never
 * sent to the server on the next request and never appears in access logs
 * or a `Referer` header, unlike a query string would.
 *
 * A failure redirects to `/login?error=...` instead of throwing a raw JSON
 * error — the caller is a browser mid-redirect, not an API client that can
 * do anything useful with a bare 400/500 response.
 */
export function oauthCallbackHandler(oauthService: OAuthService) {
    return async function oauthCallback(req: Request, res: Response): Promise<void> {
        const provider = parseProvider(req.params.provider ?? '');
        const frontendBase = config.oauth.frontendBaseUrl;
        if (!frontendBase) {
            throw new Error('OAUTH_FRONTEND_BASE_URL is not configured.');
        }

        try {
            verifyOAuthState(typeof req.query.state === 'string' ? req.query.state : undefined, provider);

            const code = req.query.code;
            if (typeof code !== 'string' || code.length === 0) {
                throw new BadRequestError('Missing authorization code.');
            }

            const adapter = getProvider(provider);
            const accessToken = await adapter.exchangeCode(code, callbackUrl(req, provider));
            const profile = await adapter.fetchProfile(accessToken);
            const user = await oauthService.resolveAccount(provider, profile, accessToken);

            const token = signAccessToken({ sub: user.id, role: user.role });
            // Not /auth/callback: that path collides with this same router's
            // own `GET /auth/:provider` (Express matches "callback" as
            // :provider before mountFrontend's SPA fallback ever runs), so a
            // real browser redirect here hit this API and 404'd instead of
            // loading the SPA — real Google/Microsoft logins were broken in
            // production. Same bug class as e2e/tests/admin.spec.ts caught
            // for /admin/audit-log; see the comment above mountFrontend(app)
            // in app.ts.
            res.redirect(`${frontendBase}/oauth/callback#token=${encodeURIComponent(token)}`);
        } catch (error) {
            const message = error instanceof BadRequestError ? error.message : 'Sign-in failed. Please try again.';
            res.redirect(`${frontendBase}/login?error=${encodeURIComponent(message)}`);
        }
    };
}
