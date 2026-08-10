import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, registerAndLogin } from '../helpers/api-client.ts';
import { promoteToAdmin } from '../helpers/db.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('GET /admin/audit-log (#103, UC-68)', () => {
    let server: TestServer;
    let adminId: string;
    let token: string;

    before(async () => {
        server = await startTestServer();
        const admin = await registerAndLogin(server.baseUrl, 'audit-admin');
        await promoteToAdmin(admin.id);
        adminId = admin.id;
        const relogged = await apiRequest(server.baseUrl, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: admin.email, password: admin.password }),
        });
        token = (relogged.body as { token: string }).token;
    });

    after(async () => {
        await server.close();
    });

    test('a non-admin gets 403', async () => {
        const user = await registerAndLogin(server.baseUrl, 'audit-non-admin');
        const { status } = await apiRequest(server.baseUrl, '/admin/audit-log', {
            headers: { Authorization: `Bearer ${user.token}` },
        });
        assert.equal(status, 403);
    });

    test('a role change appears newest-first, with the right actor/target/action', async () => {
        const target = await registerAndLogin(server.baseUrl, 'audit-target');
        const patch = await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role: 'coach' }),
        });
        assert.equal(patch.status, 200);

        const { status, body } = await apiRequest(server.baseUrl, '/admin/audit-log', {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(status, 200);
        const parsed = body as {
            entries: {
                actorId: string;
                targetUserId: string;
                action: string;
                previousValue: string;
                newValue: string;
            }[];
            total: number;
        };
        assert.ok(parsed.total >= 1);
        const newest = parsed.entries[0];
        assert.equal(newest?.actorId, adminId);
        assert.equal(newest?.targetUserId, target.id);
        assert.equal(newest?.action, 'role_change');
        assert.equal(newest?.previousValue, 'user');
        assert.equal(newest?.newValue, 'coach');
    });

    test('a combined role+status change writes two entries', async () => {
        const target = await registerAndLogin(server.baseUrl, 'audit-combined-target');
        await apiRequest(server.baseUrl, `/users/${target.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role: 'coach', status: 'suspended' }),
        });

        const { body } = await apiRequest(server.baseUrl, '/admin/audit-log?pageSize=5', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const entries = (body as { entries: { targetUserId: string; action: string }[] }).entries;
        const forTarget = entries.filter((e) => e.targetUserId === target.id);
        assert.ok(forTarget.some((e) => e.action === 'role_change'));
        assert.ok(forTarget.some((e) => e.action === 'status_change'));
    });

    test('pageSize is respected', async () => {
        const { body } = await apiRequest(server.baseUrl, '/admin/audit-log?pageSize=1', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const parsed = body as { entries: unknown[]; pageSize: number };
        assert.equal(parsed.pageSize, 1);
        assert.ok(parsed.entries.length <= 1);
    });
});
