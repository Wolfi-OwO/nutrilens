import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, registerAndLogin } from '../helpers/api-client.ts';
import { promoteToAdmin } from '../helpers/db.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('GET /admin/stats (#102, UC-66)', () => {
    let server: TestServer;
    let token: string;

    before(async () => {
        server = await startTestServer();
        const admin = await registerAndLogin(server.baseUrl, 'stats-admin');
        await promoteToAdmin(admin.id);
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
        const user = await registerAndLogin(server.baseUrl, 'stats-non-admin');
        const { status } = await apiRequest(server.baseUrl, '/admin/stats', {
            headers: { Authorization: `Bearer ${user.token}` },
        });
        assert.equal(status, 403);
    });

    test('returns counts by role/status and a signup series, reflecting a real registration', async () => {
        const before = await apiRequest(server.baseUrl, '/admin/stats', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const beforeBody = before.body as {
            usersByRole: Record<string, number>;
            usersByStatus: Record<string, number>;
            activeDietPlans: number;
            mealLogsLast7Days: number;
            mealLogsLast30Days: number;
            signupsLast30Days: { date: string; count: number }[];
        };
        assert.equal(before.status, 200);
        // Every role/status key present, even at 0 — never silently absent.
        assert.ok('user' in beforeBody.usersByRole);
        assert.ok('coach' in beforeBody.usersByRole);
        assert.ok('admin' in beforeBody.usersByRole);
        assert.ok('active' in beforeBody.usersByStatus);
        assert.ok('suspended' in beforeBody.usersByStatus);
        assert.ok('deleted' in beforeBody.usersByStatus);
        assert.ok(beforeBody.usersByRole.admin >= 1);
        assert.ok(Array.isArray(beforeBody.signupsLast30Days));

        const beforeUserCount = beforeBody.usersByRole.user ?? 0;
        await registerAndLogin(server.baseUrl, 'stats-fresh-signup');

        const after = await apiRequest(server.baseUrl, '/admin/stats', {
            headers: { Authorization: `Bearer ${token}` },
        });
        // >= not ===: other test files register users concurrently against
        // this same database, so the count can grow by more than one
        // between the two snapshots — the only real invariant here is that
        // a real registration shows up, not that nothing else did.
        const afterBody = after.body as { usersByRole: Record<string, number> };
        assert.ok((afterBody.usersByRole.user ?? 0) >= beforeUserCount + 1);
    });
});
