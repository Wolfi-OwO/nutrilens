import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { uniqueEmail } from '../helpers/random.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

const PASSWORD = 'correct horse battery staple';

describe('auth: HttpOnly session cookie', () => {
    let server: TestServer;
    let cookie: string;
    let email: string;

    before(async () => {
        server = await startTestServer();
        email = uniqueEmail('cookie');
        await fetch(`${server.baseUrl}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: PASSWORD, displayName: 'Cookie Test' }),
        });
        const login = await fetch(`${server.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: PASSWORD }),
        });
        const setCookie = login.headers.get('set-cookie') ?? '';
        cookie = setCookie.split(';')[0] ?? '';
    });

    after(async () => {
        await server.close();
    });

    test('login sets an HttpOnly, SameSite=Lax session cookie', async () => {
        const login = await fetch(`${server.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: PASSWORD }),
        });
        const setCookie = login.headers.get('set-cookie') ?? '';
        assert.match(setCookie, /^nutrilens_session=/);
        assert.match(setCookie, /HttpOnly/i);
        assert.match(setCookie, /SameSite=Lax/i);
    });

    test('the cookie authenticates a read without an Authorization header', async () => {
        const response = await fetch(`${server.baseUrl}/users/me`, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
    });

    test('a cookie-authenticated write without the CSRF header is refused', async () => {
        const response = await fetch(`${server.baseUrl}/users/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ displayName: 'Changed' }),
        });
        assert.equal(response.status, 403);
    });

    test('the same write with the CSRF header goes through the auth layer', async () => {
        const response = await fetch(`${server.baseUrl}/users/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Requested-With': 'fetch' },
            body: JSON.stringify({ displayName: 'Changed' }),
        });
        assert.notEqual(response.status, 401);
        assert.notEqual(response.status, 403);
    });

    test('a garbage cookie is rejected', async () => {
        const response = await fetch(`${server.baseUrl}/users/me`, {
            headers: { Cookie: 'nutrilens_session=not-a-jwt' },
        });
        assert.equal(response.status, 401);
    });

    test('logout clears the cookie', async () => {
        const response = await fetch(`${server.baseUrl}/auth/logout`, { method: 'POST' });
        assert.equal(response.status, 204);
        const setCookie = response.headers.get('set-cookie') ?? '';
        assert.match(setCookie, /^nutrilens_session=;/);
    });
});
