import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('weight-entries: CRUD', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('creates an entry', async () => {
        const user = await registerAndLogin(server.baseUrl, 'weight-create');
        const { status, body } = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 82.5 }),
        });
        assert.equal(status, 201);
        assert.equal((body as { weightKg: number }).weightKg, 82.5);
    });

    test('rejects a second entry the same day without overwrite, then accepts it with overwrite', async () => {
        const user = await registerAndLogin(server.baseUrl, 'weight-conflict');
        const first = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 80 }),
        });
        const firstId = (first.body as { id: string }).id;

        const conflict = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 81 }),
        });
        assert.equal(conflict.status, 409);

        const overwritten = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 81, overwrite: true }),
        });
        assert.equal(overwritten.status, 201);
        assert.equal((overwritten.body as { id: string }).id, firstId);
        assert.equal((overwritten.body as { weightKg: number }).weightKg, 81);
    });

    test('rejects a weight outside physiological bounds', async () => {
        const user = await registerAndLogin(server.baseUrl, 'weight-range');
        const { status } = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 5 }),
        });
        assert.equal(status, 400);
    });

    test('lists entries within a date range', async () => {
        const user = await registerAndLogin(server.baseUrl, 'weight-list');
        await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 80 }),
        });

        const today = new Date().toISOString().slice(0, 10);
        const inRange = await apiRequest(server.baseUrl, `/weight-entries?from=${today}T00:00:00Z`, {
            headers: authHeader(user),
        });
        assert.equal(inRange.status, 200);
        assert.equal((inRange.body as unknown[]).length, 1);

        const outOfRange = await apiRequest(server.baseUrl, '/weight-entries?to=2000-01-01', {
            headers: authHeader(user),
        });
        assert.equal((outOfRange.body as unknown[]).length, 0);
    });

    test('updates and deletes an entry', async () => {
        const user = await registerAndLogin(server.baseUrl, 'weight-update-delete');
        const create = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 80 }),
        });
        const entryId = (create.body as { id: string }).id;

        const update = await apiRequest(server.baseUrl, `/weight-entries/${entryId}`, {
            method: 'PATCH',
            headers: authHeader(user),
            body: JSON.stringify({ weightKg: 79.5 }),
        });
        assert.equal(update.status, 200);
        assert.equal((update.body as { weightKg: number }).weightKg, 79.5);

        const del = await apiRequest(server.baseUrl, `/weight-entries/${entryId}`, {
            method: 'DELETE',
            headers: authHeader(user),
        });
        assert.equal(del.status, 204);

        const get = await apiRequest(server.baseUrl, `/weight-entries/${entryId}`, { headers: authHeader(user) });
        assert.equal(get.status, 404);
    });

    test('a different user cannot delete someone else\'s entry', async () => {
        const owner = await registerAndLogin(server.baseUrl, 'weight-owner');
        const intruder = await registerAndLogin(server.baseUrl, 'weight-intruder');

        const create = await apiRequest(server.baseUrl, '/weight-entries', {
            method: 'POST',
            headers: authHeader(owner),
            body: JSON.stringify({ weightKg: 80 }),
        });
        const entryId = (create.body as { id: string }).id;

        const del = await apiRequest(server.baseUrl, `/weight-entries/${entryId}`, {
            method: 'DELETE',
            headers: authHeader(intruder),
        });
        assert.equal(del.status, 403);
    });
});
