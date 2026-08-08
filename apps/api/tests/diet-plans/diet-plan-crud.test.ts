import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

const VALID_PLAN = {
    dailyCalorieTarget: 2200,
    proteinTargetGrams: 150,
    carbTargetGrams: 250,
    fatTargetGrams: 70,
    goal: 'maintain',
};

describe('diet-plans: CRUD', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('creates a plan and it becomes the active plan', async () => {
        const user = await registerAndLogin(server.baseUrl, 'plan-create');

        const create = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify(VALID_PLAN),
        });
        assert.equal(create.status, 201);

        const active = await apiRequest(server.baseUrl, '/diet-plans/active', { headers: authHeader(user) });
        assert.equal(active.status, 200);
        assert.equal((active.body as { id: string }).id, (create.body as { id: string }).id);
    });

    test('creating a second plan archives the first (only one active at a time)', async () => {
        const user = await registerAndLogin(server.baseUrl, 'plan-archive');

        const first = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify(VALID_PLAN),
        });
        const second = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ ...VALID_PLAN, goal: 'lose_weight' }),
        });
        assert.equal(second.status, 201);

        const list = await apiRequest(server.baseUrl, '/diet-plans', { headers: authHeader(user) });
        const plans = list.body as { id: string; endsAt: string | null }[];
        const firstId = (first.body as { id: string }).id;
        const archivedFirst = plans.find((plan) => plan.id === firstId);
        assert.ok(archivedFirst);
        assert.notEqual(archivedFirst.endsAt, null);

        const active = await apiRequest(server.baseUrl, '/diet-plans/active', { headers: authHeader(user) });
        assert.equal((active.body as { id: string }).id, (second.body as { id: string }).id);
    });

    test('rejects an out-of-range calorie target with 400', async () => {
        const user = await registerAndLogin(server.baseUrl, 'plan-range');
        const { status, body } = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ ...VALID_PLAN, dailyCalorieTarget: 100 }),
        });
        assert.equal(status, 400);
        assert.equal((body as { error: string }).error, 'BadRequestError');
    });

    test('updates a plan', async () => {
        const user = await registerAndLogin(server.baseUrl, 'plan-update');
        const create = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify(VALID_PLAN),
        });
        const planId = (create.body as { id: string }).id;

        const update = await apiRequest(server.baseUrl, `/diet-plans/${planId}`, {
            method: 'PATCH',
            headers: authHeader(user),
            body: JSON.stringify({ dailyCalorieTarget: 2000 }),
        });
        assert.equal(update.status, 200);
        assert.equal((update.body as { dailyCalorieTarget: number }).dailyCalorieTarget, 2000);
    });

    test('archives a plan explicitly', async () => {
        const user = await registerAndLogin(server.baseUrl, 'plan-archive-explicit');
        const create = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify(VALID_PLAN),
        });
        const planId = (create.body as { id: string }).id;

        const archive = await apiRequest(server.baseUrl, `/diet-plans/${planId}/archive`, {
            method: 'POST',
            headers: authHeader(user),
        });
        assert.equal(archive.status, 200);
        assert.notEqual((archive.body as { endsAt: string | null }).endsAt, null);

        const active = await apiRequest(server.baseUrl, '/diet-plans/active', { headers: authHeader(user) });
        assert.equal(active.status, 404);
    });

    test('a different user cannot update someone else\'s plan', async () => {
        const owner = await registerAndLogin(server.baseUrl, 'plan-owner');
        const intruder = await registerAndLogin(server.baseUrl, 'plan-intruder');

        const create = await apiRequest(server.baseUrl, '/diet-plans', {
            method: 'POST',
            headers: authHeader(owner),
            body: JSON.stringify(VALID_PLAN),
        });
        const planId = (create.body as { id: string }).id;

        const update = await apiRequest(server.baseUrl, `/diet-plans/${planId}`, {
            method: 'PATCH',
            headers: authHeader(intruder),
            body: JSON.stringify({ dailyCalorieTarget: 1900 }),
        });
        assert.equal(update.status, 403);
    });
});
