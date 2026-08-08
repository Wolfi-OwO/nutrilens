import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest } from '../helpers/api-client.ts';
import { uniqueEmail } from '../helpers/random.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('auth: register + login', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('registers a new account', async () => {
        const email = uniqueEmail('register');
        const { status, body } = await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email, password: 'correct horse battery staple', displayName: 'Reg Test' }),
        });

        assert.equal(status, 201);
        const user = body as { id: string; email: string; role: string };
        assert.equal(user.email, email);
        assert.equal(user.role, 'user');
        assert.ok(user.id);
    });

    test('rejects a duplicate email with 409', async () => {
        const email = uniqueEmail('duplicate');
        const payload = { email, password: 'correct horse battery staple', displayName: 'Dup Test' };

        const first = await apiRequest(server.baseUrl, '/users', { method: 'POST', body: JSON.stringify(payload) });
        assert.equal(first.status, 201);

        const second = await apiRequest(server.baseUrl, '/users', { method: 'POST', body: JSON.stringify(payload) });
        assert.equal(second.status, 409);
    });

    test('rejects a password shorter than 8 characters', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email: uniqueEmail('shortpw'), password: 'short', displayName: 'Short' }),
        });
        assert.equal(status, 400);
        assert.equal((body as { error: string }).error, 'BadRequestError');
    });

    test('rejects a malformed request body with structured field-level issues', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email: uniqueEmail('malformed') }),
        });
        assert.equal(status, 400);
        const parsed = body as { error: string; issues: { path: string }[] };
        assert.equal(parsed.error, 'ValidationError');
        assert.ok(parsed.issues.some((issue) => issue.path === 'password'));
        assert.ok(parsed.issues.some((issue) => issue.path === 'displayName'));
    });

    test('logs in with correct credentials', async () => {
        const email = uniqueEmail('login');
        const password = 'correct horse battery staple';
        await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email, password, displayName: 'Login Test' }),
        });

        const { status, body } = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        assert.equal(status, 200);
        const parsed = body as { token: string; user: { email: string } };
        assert.ok(parsed.token.length > 0);
        assert.equal(parsed.user.email, email);
    });

    test('rejects a wrong password with 401', async () => {
        const email = uniqueEmail('wrongpw');
        await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email, password: 'correct horse battery staple', displayName: 'Wrong PW' }),
        });

        const { status } = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: 'not the right password' }),
        });
        assert.equal(status, 401);
    });

    test('rejects login for an unknown email with the same 401 as a wrong password', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: uniqueEmail('unknown'), password: 'whatever it is' }),
        });
        assert.equal(status, 401);
        assert.equal((body as { message: string }).message, 'Invalid email or password.');
    });

    test('rejects a request to a protected route with no token', async () => {
        const { status } = await apiRequest(server.baseUrl, '/users/me');
        assert.equal(status, 401);
    });
});
