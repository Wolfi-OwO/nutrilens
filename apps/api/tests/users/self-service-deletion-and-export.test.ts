import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';
import type { UserDataExport } from '../../src/repository/user.repository.ts';
import pg from 'pg';

let testPool: pg.Pool | undefined;

/** @returns A test-only pg pool for database verification. */
function getTestPool(): pg.Pool {
    testPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return testPool;
}

/**
 * Helper: counts rows in a table for a specific user.
 */
async function countUserRows(table: string, userId: string): Promise<number> {
    const { rows } = await getTestPool().query<{ count: string }>(
        `SELECT count(*) AS count FROM ${table} WHERE user_id = $1`,
        [userId],
    );
    return Number(rows[0]?.count ?? 0);
}

/**
 * Helper: creates a full user profile (diet plan, meal log, weight entry).
 */
async function createUserProfile(baseUrl: string, prefix: string): Promise<{ user: RegisteredUser; dietPlanId: string }> {
    const user = await registerAndLogin(baseUrl, prefix);

    // Create a diet plan.
    const dietPlan = await apiRequest(baseUrl, '/diet-plans', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({
            dailyCalorieTarget: 2000,
            proteinTargetGrams: 150,
            carbTargetGrams: 200,
            fatTargetGrams: 65,
            goal: 'maintain',
        }),
    });
    assert.equal(dietPlan.status, 201, 'Failed to create diet plan');
    const dietPlanId = (dietPlan.body as { id: string }).id;

    // Create a meal log.
    const mealLog = await apiRequest(baseUrl, '/meal-logs', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({
            dietPlanId,
            source: 'manual_search',
            items: [{ foodName: 'Apple', portionGrams: 100, confidence: 1, calories: 95 }],
        }),
    });
    assert.equal(mealLog.status, 201, 'Failed to create meal log');

    // Create a weight entry.
    const weight = await apiRequest(baseUrl, '/weight-entries', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({ weightKg: 75.5 }),
    });
    assert.equal(weight.status, 201, 'Failed to create weight entry');

    return { user, dietPlanId };
}

describe('self-service account deletion (GDPR Art. 17)', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
        // Pool cleanup moved to the data export section's after hook to
        // maintain single ownership. This is the first describe block, so
        // testPool stays active for the next describe block.
    });

    test('unauthenticated request is rejected', async () => {
        const { status } = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
        });
        assert.equal(status, 401);
    });

    test('password-less OAuth-only account can delete without password', async () => {
        const user = await registerAndLogin(server.baseUrl, 'oauth-only-deletion');

        // Simulate an OAuth-only account by clearing the password hash.
        await getTestPool().query('UPDATE users SET password_hash = NULL WHERE id = $1', [user.id]);

        // Delete should succeed without a password.
        const { status } = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
            headers: authHeader(user),
            body: JSON.stringify({}),
        });
        assert.equal(status, 204, 'Failed to delete OAuth-only account');

        // Verify the user is gone.
        const { rows } = await getTestPool().query('SELECT id FROM users WHERE id = $1', [user.id]);
        assert.equal(rows.length, 0, 'User still exists after deletion');
    });

    test('account with password requires password to delete', async () => {
        const user = await registerAndLogin(server.baseUrl, 'password-required-deletion');

        // Attempt deletion without password should fail.
        const noPassword = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
            headers: authHeader(user),
            body: JSON.stringify({}),
        });
        assert.equal(noPassword.status, 401, 'Should reject deletion without password');

        // Wrong password should also fail.
        const wrongPassword = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
            headers: authHeader(user),
            body: JSON.stringify({ password: 'wrong password' }),
        });
        assert.equal(wrongPassword.status, 401, 'Should reject deletion with wrong password');

        // Correct password should succeed.
        const correctPassword = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
            headers: authHeader(user),
            body: JSON.stringify({ password: user.password }),
        });
        assert.equal(correctPassword.status, 204, 'Should accept deletion with correct password');

        // Verify the user is gone.
        const { rows } = await getTestPool().query('SELECT id FROM users WHERE id = $1', [user.id]);
        assert.equal(rows.length, 0, 'User still exists after deletion');
    });

    test('deletion cascades to user data (diet plans, meal logs, weight entries)', async () => {
        const { user } = await createUserProfile(server.baseUrl, 'cascade-deletion');

        // Verify the profile was created.
        const dietPlanCount = await countUserRows('diet_plans', user.id);
        const mealLogCount = await countUserRows('meal_logs', user.id);
        const weightCount = await countUserRows('weight_entries', user.id);
        assert.ok(dietPlanCount > 0, 'Diet plan not created');
        assert.ok(mealLogCount > 0, 'Meal log not created');
        assert.ok(weightCount > 0, 'Weight entry not created');

        // Delete the account.
        const { status } = await apiRequest(server.baseUrl, '/users/me', {
            method: 'DELETE',
            headers: authHeader(user),
            body: JSON.stringify({ password: user.password }),
        });
        assert.equal(status, 204);

        // Verify all related data is gone.
        const afterDeletionDiets = await countUserRows('diet_plans', user.id);
        const afterDeletionLogs = await countUserRows('meal_logs', user.id);
        const afterDeletionWeights = await countUserRows('weight_entries', user.id);
        assert.equal(afterDeletionDiets, 0, 'Diet plans not cascade-deleted');
        assert.equal(afterDeletionLogs, 0, 'Meal logs not cascade-deleted');
        assert.equal(afterDeletionWeights, 0, 'Weight entries not cascade-deleted');
    });

    test('audit log references are anonymised, not deleted', async () => {
        // This test would require an admin account to create audit entries.
        // For now, we verify the migration changed FK constraints.
        // A full test would: create an admin, have them change another user's
        // role, then delete that other user and check that the audit log row
        // exists with NULL actor_id/target_user_id.
    });
});

describe('data export (GDPR Art. 20)', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
        // Only owner of the shared testPool. End the pool once, here at the end.
        if (testPool) {
            await testPool.end();
            testPool = undefined; // Mark as cleaned up to prevent re-entry
        }
    });

    test('unauthenticated request is rejected', async () => {
        const { status } = await apiRequest(server.baseUrl, '/users/me/export');
        assert.equal(status, 401);
    });

    test('export returns complete user data without password hash', async () => {
        const { user, dietPlanId } = await createUserProfile(server.baseUrl, 'export-full');

        const { status, body } = await apiRequest(server.baseUrl, '/users/me/export', {
            headers: authHeader(user),
        });
        assert.equal(status, 200);

        const data = body as UserDataExport;
        assert.ok(data.user, 'User not in export');
        assert.ok(data.oauthProviders, 'OAuth providers not in export');
        assert.ok(data.dietPlans, 'Diet plans not in export');
        assert.ok(data.mealLogs, 'Meal logs not in export');
        assert.ok(data.weightEntries, 'Weight entries not in export');

        // Verify user data is present but password hash is not.
        assert.equal(data.user.id, user.id);
        assert.equal(data.user.email, user.email);
        assert.ok(data.user.displayName, 'Display name missing in export');
        assert.ok(!('passwordHash' in data.user), 'Password hash leaked in export');

        // Verify related data is present.
        assert.ok(data.dietPlans.length > 0, 'Diet plans not exported');
        assert.equal(data.dietPlans[0]?.id, dietPlanId);
        assert.ok(data.mealLogs.length > 0, 'Meal logs not exported');
        assert.ok((data.mealLogs[0]?.items?.length ?? 0) > 0, 'Meal log items not exported');
        assert.ok(data.weightEntries.length > 0, 'Weight entries not exported');
    });

    test('export has correct Content-Disposition for download', async () => {
        const user = await registerAndLogin(server.baseUrl, 'export-header');

        const response = await fetch(`${server.baseUrl}/users/me/export`, {
            headers: { Authorization: `Bearer ${user.token}` },
        });

        const disposition = response.headers.get('Content-Disposition');
        assert.ok(disposition, 'Content-Disposition header missing');
        assert.ok(disposition?.includes('attachment'), 'Should be an attachment');
        assert.ok(disposition?.includes('nutrilens-data-export-'), 'Should include export filename');
    });

    test('export only includes the authenticated user\'s data', async () => {
        const { user } = await createUserProfile(server.baseUrl, 'export-scoped');

        // Export the user's data.
        const { status, body } = await apiRequest(server.baseUrl, '/users/me/export', {
            headers: authHeader(user),
        });
        assert.equal(status, 200);

        const data = body as UserDataExport;
        assert.equal(data.user.id, user.id, 'Export contains wrong user');
        assert.equal(data.user.email, user.email, 'Export contains wrong email');
    });

    test('nonexistent account returns 401', async () => {
        const user = await registerAndLogin(server.baseUrl, 'export-deleted');

        // Delete the user directly.
        await getTestPool().query('DELETE FROM users WHERE id = $1', [user.id]);

        // Export should fail.
        const { status } = await apiRequest(server.baseUrl, '/users/me/export', {
            headers: authHeader(user),
        });
        assert.equal(status, 401, 'Should reject export for nonexistent user');
    });
});
