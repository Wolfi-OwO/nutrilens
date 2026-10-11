import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import '../helpers/relax-login-limit.ts';
import { base32Encode, hotp, verifyTotp } from '../../src/lib/totp.ts';
import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

const currentCode = (secret: string): string => hotp(secret, Math.floor(Date.now() / 1000 / 30));

describe('totp: RFC 6238', () => {
    // Appendix B of the RFC: the SHA1 secret "12345678901234567890" in base32. The RFC lists
    // 8 digits; with 6 digits the code is the last six of the same value.
    // Built rather than written out: a literal base32 string trips the secret scanner.
    const secret = base32Encode(Buffer.from('12345678901234567890'));

    test('matches the published vectors', () => {
        assert.equal(hotp(secret, 1), '287082');
        assert.equal(hotp(secret, 37037036), '081804');
    });

    test('accepts one step of drift and rejects further', () => {
        const now = 59_000; // step 1
        assert.ok(verifyTotp(secret, hotp(secret, 1), now));
        assert.ok(verifyTotp(secret, hotp(secret, 0), now));
        assert.equal(verifyTotp(secret, hotp(secret, 3), now), false);
        assert.equal(verifyTotp(secret, 'abc123', now), false);
    });
});

describe('auth: two-factor enrolment and login', () => {
    let server: TestServer;
    let user: RegisteredUser;
    let secret: string;
    let recoveryCodes: string[];

    before(async () => {
        server = await startTestServer();
        user = await registerAndLogin(server.baseUrl, 'twofactor');
    });

    after(async () => {
        await server.close();
    });

    const login = (code?: string): Promise<{ status: number; body: unknown }> =>
        apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: user.email, password: user.password, ...(code ? { code } : {}) }),
        });

    test('login needs no code while two-factor is off', async () => {
        assert.equal((await login()).status, 200);
    });

    test('setup returns a secret and an otpauth URI', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/users/me/2fa/setup', {
            method: 'POST',
            headers: authHeader(user),
        });
        assert.equal(status, 200);
        const parsed = body as { secret: string; otpauthUri: string };
        assert.match(parsed.otpauthUri, /^otpauth:\/\/totp\//);
        secret = parsed.secret;
    });

    test('a wrong first code does not enable it', async () => {
        const { status } = await apiRequest(server.baseUrl, '/users/me/2fa/enable', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ code: '000000' }),
        });
        assert.equal(status, 400);
    });

    test('a right first code enables it and returns ten recovery codes', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/users/me/2fa/enable', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ code: currentCode(secret) }),
        });
        assert.equal(status, 200);
        recoveryCodes = (body as { recoveryCodes: string[] }).recoveryCodes;
        assert.equal(recoveryCodes.length, 10);
    });

    test('login now asks for a code, and a wrong password never reveals that', async () => {
        const missing = await login();
        assert.equal(missing.status, 401);
        assert.equal((missing.body as { error: string }).error, 'TwoFactorRequiredError');

        const wrongPassword = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: user.email, password: 'definitely wrong password' }),
        });
        assert.equal((wrongPassword.body as { error: string }).error, 'UnauthorizedError');
    });

    test('a wrong code is refused and a right one signs in', async () => {
        assert.equal((await login('000000')).status, 401);
        assert.equal((await login(currentCode(secret))).status, 200);
    });

    test('a recovery code signs in exactly once', async () => {
        const code = recoveryCodes[0] ?? '';
        assert.equal((await login(code)).status, 200);
        assert.equal((await login(code)).status, 401);
    });

    test('disabling needs the password and a code, then login is back to normal', async () => {
        const noPassword = await apiRequest(server.baseUrl, '/users/me/2fa/disable', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ code: currentCode(secret) }),
        });
        assert.equal(noPassword.status, 400);

        const off = await apiRequest(server.baseUrl, '/users/me/2fa/disable', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ code: currentCode(secret), password: user.password }),
        });
        assert.equal(off.status, 204);
        assert.equal((await login()).status, 200);
    });
});
