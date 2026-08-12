import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest } from '../helpers/api-client.ts';
import { uniqueEmail } from '../helpers/random.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';
import { getPool } from '../../src/database/connection.ts';
import { signAccessToken } from '../../src/lib/jwt.ts';
import { AuthProviderRepository } from '../../src/repository/auth-provider.repository.ts';
import { UserRepository } from '../../src/repository/user.repository.ts';
import { OAuthService } from '../../src/services/oauth-service.ts';

// No GITHUB_CLIENT_ID/GOOGLE_CLIENT_ID/MICROSOFT_CLIENT_ID are set in the
// test environment (see .env.test / CI) — exercising the real
// provider redirect would mean faking github.com/google.com/microsoft's own
// servers. What's actually worth proving at the HTTP layer is the wiring:
// unconfigured providers 404 cleanly, and a token this flow issues is
// indistinguishable to requireAuth from a password-login token (same
// signAccessToken call, same claims shape — see oauth.handlers.ts).

describe('oauth routes', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('GET /auth/providers lists no providers when none are configured', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/auth/providers');
        assert.equal(status, 200);
        assert.deepEqual(body, { providers: [] });
    });

    test('GET /auth/:provider 404s for an unknown provider name', async () => {
        const { status } = await apiRequest(server.baseUrl, '/auth/not-a-real-provider', { redirect: 'manual' });
        assert.equal(status, 404);
    });

    test('GET /auth/:provider 404s for a known but unconfigured provider', async () => {
        const { status } = await apiRequest(server.baseUrl, '/auth/github', { redirect: 'manual' });
        assert.equal(status, 404);
    });

    test('a token for an OAuth-resolved account passes requireAuth exactly like a password login', async () => {
        const users = new UserRepository(getPool());
        const authProviders = new AuthProviderRepository(getPool());
        const oauthService = new OAuthService(users, authProviders);

        const email = uniqueEmail('oauth-route');
        const user = await oauthService.resolveAccount(
            'github',
            {
                providerUserId: `route-test-${String(Math.random())}`,
                email,
                emailVerified: true,
                displayName: 'OAuth Route Test',
                pictureUrl: null,
            },
            'test-access-token',
        );

        const token = signAccessToken({ sub: user.id, role: user.role });
        const { status, body } = await apiRequest(server.baseUrl, '/users/me', {
            headers: { Authorization: `Bearer ${token}` },
        });

        assert.equal(status, 200);
        assert.equal((body as { email: string }).email, email);
    });
});
