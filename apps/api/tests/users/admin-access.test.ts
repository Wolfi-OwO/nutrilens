import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import { promoteToAdmin } from '../helpers/db.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('users: /users/me and admin-only /users', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('a logged-in user can fetch their own profile', async () => {
        const user = await registerAndLogin(server.baseUrl, 'me');
        const { status, body } = await apiRequest(server.baseUrl, '/users/me', { headers: authHeader(user) });
        assert.equal(status, 200);
        assert.equal((body as { id: string }).id, user.id);
    });

    test('a regular user is forbidden from listing all users', async () => {
        const user = await registerAndLogin(server.baseUrl, 'not-admin');
        const { status } = await apiRequest(server.baseUrl, '/users', { headers: authHeader(user) });
        assert.equal(status, 403);
    });

    test('an admin can list all users', async () => {
        const admin = await registerAndLogin(server.baseUrl, 'admin');
        await promoteToAdmin(admin.id);

        // The token was minted before the promotion — role changes require a
        // fresh login, same as any real client would need to do.
        const relogged = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: admin.email, password: admin.password }),
        });
        const token = (relogged.body as { token: string }).token;

        const { status, body } = await apiRequest(server.baseUrl, '/users', {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(status, 200);
        const parsed = body as { users: { id: string }[]; total: number; page: number; pageSize: number };
        assert.ok(Array.isArray(parsed.users));
        assert.ok(parsed.users.some((listedUser) => listedUser.id === admin.id));
        assert.ok(parsed.total >= parsed.users.length);
        assert.equal(parsed.page, 1);
    });
});
