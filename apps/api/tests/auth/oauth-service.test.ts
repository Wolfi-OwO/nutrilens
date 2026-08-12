import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import pg from 'pg';

import { getPool } from '../../src/database/connection.ts';
import type { OAuthProfile } from '../../src/lib/oauth-providers.ts';
import { AuthProviderRepository } from '../../src/repository/auth-provider.repository.ts';
import { UserRepository } from '../../src/repository/user.repository.ts';
import { OAuthService } from '../../src/services/oauth-service.ts';
import { uniqueEmail } from '../helpers/random.ts';

// Exercises OAuthService directly against the real test database, not the
// full HTTP flow — the provider adapters (lib/oauth-providers.ts) make real
// requests to github.com/google.com/login.microsoftonline.com, which this
// suite has no business calling. Everything downstream of "here is a
// verified profile from some provider" is what actually needs coverage:
// the account-linking/creation decision is the security-sensitive part.

function makeProfile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
    return {
        providerUserId: `provider-${String(Math.random())}`,
        email: uniqueEmail('oauth'),
        emailVerified: true,
        displayName: 'OAuth Test User',
        pictureUrl: null,
        ...overrides,
    };
}

// resolveAccount's accessToken param is only ever read by microsoft's Graph
// photo call (lib/oauth-providers.ts) — irrelevant to every test below,
// which never configures Microsoft credentials, so a placeholder is fine.
const FAKE_ACCESS_TOKEN = 'test-access-token';

describe('OAuthService.resolveAccount', () => {
    const pool = getPool();
    const users = new UserRepository(pool);
    const authProviders = new AuthProviderRepository(pool);
    const service = new OAuthService(users, authProviders);

    test('creates a new account for a first-time verified profile', async () => {
        const profile = makeProfile();
        const user = await service.resolveAccount('github', profile, FAKE_ACCESS_TOKEN);

        assert.equal(user.email, profile.email);
        assert.equal(user.displayName, profile.displayName);

        const link = await authProviders.findByProviderUserId('github', profile.providerUserId);
        assert.equal(link?.userId, user.id);
    });

    test('a second login with the same provider identity returns the same account', async () => {
        const profile = makeProfile();
        const first = await service.resolveAccount('github', profile, FAKE_ACCESS_TOKEN);
        const second = await service.resolveAccount('github', profile, FAKE_ACCESS_TOKEN);

        assert.equal(second.id, first.id);
    });

    test('links to an existing account when the verified email matches', async () => {
        const email = uniqueEmail('link-verified');
        const existing = await users.create({ email, displayName: 'Existing User' });

        const profile = makeProfile({ email, emailVerified: true });
        const linked = await service.resolveAccount('google', profile, FAKE_ACCESS_TOKEN);

        assert.equal(linked.id, existing.id);
        const link = await authProviders.findByProviderUserId('google', profile.providerUserId);
        assert.equal(link?.userId, existing.id);
    });

    test('refuses to link OR silently create when an unverified email collides with an existing account', async () => {
        const email = uniqueEmail('link-unverified');
        await users.create({ email, displayName: 'Victim Account' });

        const profile = makeProfile({ email, emailVerified: false });

        // Must be a clear, loud rejection — not a silent link (account
        // takeover) and not a silent new account (impossible anyway, given
        // the UNIQUE constraint on users.email, but the point is this path
        // must never even attempt it).
        await assert.rejects(() => service.resolveAccount('google', profile, FAKE_ACCESS_TOKEN), /already exists/i);
    });

    test('an unverified email that matches nobody creates a normal new account', async () => {
        const profile = makeProfile({ emailVerified: false });
        const user = await service.resolveAccount('google', profile, FAKE_ACCESS_TOKEN);
        assert.equal(user.email, profile.email);
    });

    test('rejects a profile with no email at all', async () => {
        const profile = makeProfile({ email: null });
        await assert.rejects(() => service.resolveAccount('github', profile, FAKE_ACCESS_TOKEN), /email/i);
    });

    test('the same provider identity can link to only one account (repository-level uniqueness)', async () => {
        const profile = makeProfile();
        await service.resolveAccount('microsoft', profile, FAKE_ACCESS_TOKEN);

        // A second, unrelated user later authenticating with the exact same
        // provider_user_id (shouldn't happen in practice — provider ids are
        // unique per provider account — but the DB constraint is the real
        // guarantee, not application logic) resolves back to the same link.
        const again = await service.resolveAccount('microsoft', profile, FAKE_ACCESS_TOKEN);
        const link = await authProviders.findByProviderUserId('microsoft', profile.providerUserId);
        assert.equal(again.id, link?.userId);
    });
});

// A minimal pg pool check ensures the migration actually ran in this test
// DB before the suite above depends on the auth_providers table existing.
describe('migration 0004 sanity check', () => {
    test('auth_providers table exists and users.password_hash is nullable', async () => {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        try {
            const table = await pool.query<{ exists: string | null }>(
                "SELECT to_regclass('auth_providers') AS exists",
            );
            assert.ok(table.rows[0]?.exists, 'auth_providers table should exist after migration 0004');

            const column = await pool.query<{ is_nullable: string }>(
                "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash'",
            );
            assert.equal(column.rows[0]?.is_nullable, 'YES');
        } finally {
            await pool.end();
        }
    });
});
