import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

const VALID_PLAN = {
    dailyCalorieTarget: 2200,
    proteinTargetGrams: 150,
    carbTargetGrams: 250,
    fatTargetGrams: 70,
    goal: 'maintain',
};

async function withActivePlan(server: TestServer, prefix: string): Promise<RegisteredUser> {
    const user = await registerAndLogin(server.baseUrl, prefix);
    await apiRequest(server.baseUrl, '/diet-plans', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify(VALID_PLAN),
    });
    return user;
}

describe('meal-logs: CRUD', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('rejects logging a meal without an active diet plan', async () => {
        const user = await registerAndLogin(server.baseUrl, 'log-no-plan');
        const { status } = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({
                source: 'manual_search',
                items: [{ foodName: 'Apple', portionGrams: 150, calories: 80 }],
            }),
        });
        assert.equal(status, 409);
    });

    test('creates a log and derives totals server-side, ignoring a client-supplied total', async () => {
        const user = await withActivePlan(server, 'log-create');

        const { status, body } = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({
                source: 'manual_search',
                // A bogus client total must be ignored — the server sums items.
                totalCalories: 999999,
                items: [
                    { foodName: 'Apple', portionGrams: 150, calories: 80, proteinGrams: 0, carbGrams: 21, fatGrams: 0 },
                    { foodName: 'Peanut butter', portionGrams: 30, calories: 180, proteinGrams: 7, carbGrams: 6, fatGrams: 15 },
                ],
            }),
        });

        assert.equal(status, 201);
        const log = body as { totalCalories: number; proteinGrams: number; items: unknown[] };
        assert.equal(log.totalCalories, 260);
        assert.equal(log.proteinGrams, 7);
        assert.equal(log.items.length, 2);
    });

    test('rejects an empty items array with a structured validation error', async () => {
        const user = await withActivePlan(server, 'log-empty-items');
        const { status, body } = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ source: 'manual_search', items: [] }),
        });
        assert.equal(status, 400);
        assert.equal((body as { error: string }).error, 'ValidationError');
    });

    test('updates a log by replacing its items and recomputing totals', async () => {
        const user = await withActivePlan(server, 'log-update');
        const create = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({
                source: 'manual_search',
                items: [{ foodName: 'Apple', portionGrams: 150, calories: 80 }],
            }),
        });
        const logId = (create.body as { id: string }).id;

        const update = await apiRequest(server.baseUrl, `/meal-logs/${logId}`, {
            method: 'PATCH',
            headers: authHeader(user),
            body: JSON.stringify({
                items: [{ foodName: 'Banana', portionGrams: 120, calories: 105 }],
            }),
        });
        assert.equal(update.status, 200);
        const updated = update.body as { totalCalories: number; items: { foodName: string }[] };
        assert.equal(updated.totalCalories, 105);
        assert.equal(updated.items.length, 1);
        assert.equal(updated.items[0]?.foodName, 'Banana');
    });

    test('deletes a log', async () => {
        const user = await withActivePlan(server, 'log-delete');
        const create = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({
                source: 'manual_search',
                items: [{ foodName: 'Apple', portionGrams: 150, calories: 80 }],
            }),
        });
        const logId = (create.body as { id: string }).id;

        const del = await apiRequest(server.baseUrl, `/meal-logs/${logId}`, {
            method: 'DELETE',
            headers: authHeader(user),
        });
        assert.equal(del.status, 204);

        const get = await apiRequest(server.baseUrl, `/meal-logs/${logId}`, { headers: authHeader(user) });
        assert.equal(get.status, 404);
    });

    test('a different user cannot read someone else\'s log', async () => {
        const owner = await withActivePlan(server, 'log-owner');
        const intruder = await registerAndLogin(server.baseUrl, 'log-intruder');

        const create = await apiRequest(server.baseUrl, '/meal-logs', {
            method: 'POST',
            headers: authHeader(owner),
            body: JSON.stringify({
                source: 'manual_search',
                items: [{ foodName: 'Apple', portionGrams: 150, calories: 80 }],
            }),
        });
        const logId = (create.body as { id: string }).id;

        const get = await apiRequest(server.baseUrl, `/meal-logs/${logId}`, { headers: authHeader(intruder) });
        assert.equal(get.status, 403);
    });
});
