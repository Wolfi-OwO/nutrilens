import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import { promoteToAdmin, suspendOtherActiveAdmins } from '../helpers/db.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

interface RegisteredUser {
    id: string;
    email: string;
    password: string;
    token: string;
}

/** Registers a user, promotes them to admin, then re-logs-in so the token
 * actually carries `role: 'admin'` — a role change never updates an
 * already-issued token, same as any real client. */
async function registerAdmin(baseUrl: string, prefix: string): Promise<RegisteredUser> {
    const user = await registerAndLogin(baseUrl, prefix);
    await promoteToAdmin(user.id);
    const relogged = await apiRequest(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, password: user.password }),
    });
    const token = (relogged.body as { token: string }).token;
    return { ...user, token };
}

describe('admin: user search/filter/pagination (#100)', () => {
    let server: TestServer;
    let admin: RegisteredUser;

    before(async () => {
        server = await startTestServer();
        admin = await registerAdmin(server.baseUrl, 'search-admin');
    });

    after(async () => {
        await server.close();
    });

    test('filters by role', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/users?role=admin', {
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.equal(status, 200);
        const parsed = body as { users: { role: string }[] };
        assert.ok(parsed.users.every((u) => u.role === 'admin'));
        assert.ok(parsed.users.some((u) => u.role === 'admin'));
    });

    test('caps pageSize and rejects an invalid one', async () => {
        const tooLarge = await apiRequest(server.baseUrl, '/users?pageSize=1000', {
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.equal(tooLarge.status, 400);

        const valid = await apiRequest(server.baseUrl, '/users?pageSize=1&page=1', {
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.equal(valid.status, 200);
        const parsed = valid.body as { users: unknown[]; pageSize: number };
        assert.equal(parsed.pageSize, 1);
        assert.ok(parsed.users.length <= 1);
    });

    test('search by email substring finds the right user', async () => {
        const uniqueTag = `findbyemail-${String(Math.random()).slice(2, 10)}`;
        const email = `${uniqueTag}@example.test`;
        await apiRequest(server.baseUrl, '/users', {
            method: 'POST',
            body: JSON.stringify({ email, password: 'correct horse battery staple', displayName: 'Findable' }),
        });

        const { status, body } = await apiRequest(server.baseUrl, `/users?q=${uniqueTag}`, {
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.equal(status, 200);
        const parsed = body as { users: { email: string }[]; total: number };
        assert.equal(parsed.total, 1);
        assert.equal(parsed.users[0]?.email, email);
    });
});

describe('admin: change role/status (#101, UC-65)', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('a non-admin gets 403', async () => {
        const caller = await registerAndLogin(server.baseUrl, 'not-admin-patch');
        const target = await registerAndLogin(server.baseUrl, 'patch-target-1');
        const { status } = await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: authHeader(caller),
            body: JSON.stringify({ role: 'coach' }),
        });
        assert.equal(status, 403);
    });

    test('an admin promotes a user to coach, and it is reflected + audited', async () => {
        const admin = await registerAdmin(server.baseUrl, 'promote-admin');
        const target = await registerAndLogin(server.baseUrl, 'promote-target');

        const { status, body } = await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${admin.token}` },
            body: JSON.stringify({ role: 'coach' }),
        });
        assert.equal(status, 200);
        assert.equal((body as { role: string }).role, 'coach');

        const auditRes = await apiRequest(server.baseUrl, '/admin/audit-log', {
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        const entries = (auditRes.body as { entries: { targetUserId: string; action: string }[] }).entries;
        assert.ok(
            entries.some((e) => e.targetUserId === target.id && e.action === 'role_change'),
            'expected a role_change audit entry for the promoted user',
        );
    });

    test('an admin suspends a user, and it is reflected + audited', async () => {
        const admin = await registerAdmin(server.baseUrl, 'suspend-admin');
        const target = await registerAndLogin(server.baseUrl, 'suspend-target');

        const { status, body } = await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${admin.token}` },
            body: JSON.stringify({ status: 'suspended' }),
        });
        assert.equal(status, 200);
        assert.equal((body as { status: string }).status, 'suspended');

        // Suspended accounts can't log in (register-login.test.ts covers the
        // general case) — confirms the change is real, not just echoed back.
        const loginAttempt = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: target.email, password: target.password }),
        });
        assert.equal(loginAttempt.status, 401);
    });

    test('rejects a body with neither role nor status', async () => {
        const admin = await registerAdmin(server.baseUrl, 'empty-body-admin');
        const target = await registerAndLogin(server.baseUrl, 'empty-body-target');
        const { status } = await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${admin.token}` },
            body: JSON.stringify({}),
        });
        assert.equal(status, 400);
    });

    test('404s for a nonexistent target user', async () => {
        const admin = await registerAdmin(server.baseUrl, 'missing-target-admin');
        const { status } = await apiRequest(server.baseUrl, '/users/00000000-0000-0000-0000-000000000000', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${admin.token}` },
            body: JSON.stringify({ role: 'coach' }),
        });
        assert.equal(status, 404);
    });
});

describe('admin: lockout guards (organizational/access-control.md)', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('an admin cannot suspend their own account', async () => {
        const admin = await registerAdmin(server.baseUrl, 'self-suspend-admin');
        const { status } = await apiRequest(server.baseUrl, `/users/${admin.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${admin.token}` },
            body: JSON.stringify({ status: 'suspended' }),
        });
        assert.equal(status, 403);
    });

    test('the last active admin cannot be demoted by another admin', async () => {
        // Two admins so the *acting* admin isn't also the target — proves
        // this is the last-admin count, not just a same-account guard.
        const lastAdmin = await registerAdmin(server.baseUrl, 'last-admin-solo');
        const otherAdmin = await registerAdmin(server.baseUrl, 'other-admin-demoter');

        const suspendOther = await apiRequest(server.baseUrl, `/users/${otherAdmin.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${lastAdmin.token}` },
            body: JSON.stringify({ status: 'suspended' }),
        });
        assert.equal(suspendOther.status, 200);

        // The guard counts active admins across the WHOLE table — a
        // genuinely global invariant — so any other concurrently-running
        // test file's own admin setup can otherwise mask the zero-remaining
        // case this test exists to exercise. See suspendOtherActiveAdmins's
        // doc comment.
        await suspendOtherActiveAdmins([lastAdmin.id]);

        // otherAdmin is now suspended (not counted as active) — lastAdmin's
        // own token is still valid for this request (no re-login needed,
        // suspension only blocks future logins), so demoting lastAdmin via
        // its own token would leave zero active admins.
        const demoteLast = await apiRequest(server.baseUrl, `/users/${lastAdmin.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${otherAdmin.token}` },
            body: JSON.stringify({ role: 'user' }),
        });
        assert.equal(demoteLast.status, 409);
    });

    test('promoting a user to admin first, so an existing admin CAN be safely demoted', async () => {
        const admin = await registerAdmin(server.baseUrl, 'safe-demote-admin');
        const backup = await registerAdmin(server.baseUrl, 'safe-demote-backup');

        const { status, body } = await apiRequest(server.baseUrl, `/users/${admin.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${backup.token}` },
            body: JSON.stringify({ role: 'user' }),
        });
        assert.equal(status, 200);
        assert.equal((body as { role: string }).role, 'user');
    });
});
