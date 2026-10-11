import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

interface Summary {
    volumeMl: number;
    hydrationMl: number;
    kcal: number;
    carbsG: number;
    sugarG: number;
    alcoholG: number;
    unsweetenedShare: number | null;
    quality: string;
}

const dayStart = '2026-03-10T00:00:00.000Z';
const dayEnd = '2026-03-11T00:00:00.000Z';
const noon = '2026-03-10T12:00:00.000Z';

describe('drink logs', () => {
    let server: TestServer;
    let user: RegisteredUser;

    before(async () => {
        server = await startTestServer();
        user = await registerAndLogin(server.baseUrl, 'drinks');
    });

    after(async () => {
        await server.close();
    });

    const log = (u: RegisteredUser, drinkType: string, volumeMl: number): Promise<{ status: number; body: unknown }> =>
        apiRequest(server.baseUrl, '/drink-logs', {
            method: 'POST',
            headers: authHeader(u),
            body: JSON.stringify({ drinkType, volumeMl, loggedAt: noon }),
        });

    const summary = async (u: RegisteredUser): Promise<Summary> => {
        const { status, body } = await apiRequest(
            server.baseUrl,
            `/drink-logs?from=${encodeURIComponent(dayStart)}&to=${encodeURIComponent(dayEnd)}`,
            { headers: authHeader(u) },
        );
        assert.equal(status, 200);
        return (body as { summary: Summary }).summary;
    };

    test('requires authentication', async () => {
        assert.equal((await apiRequest(server.baseUrl, '/drinks')).status, 401);
    });

    test('the catalog lists the eight drinks', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/drinks', { headers: authHeader(user) });
        assert.equal(status, 200);
        assert.equal((body as { items: unknown[] }).items.length, 8);
    });

    test('an empty day is "none", never a bad day', async () => {
        const fresh = await registerAndLogin(server.baseUrl, 'drinks-empty');
        const s = await summary(fresh);
        assert.equal(s.quality, 'none');
        assert.equal(s.unsweetenedShare, null);
        assert.equal(s.volumeMl, 0);
    });

    test('500 ml of juice counts in hydration and in the day\'s carbs', async () => {
        const juiceUser = await registerAndLogin(server.baseUrl, 'drinks-juice');
        assert.equal((await log(juiceUser, 'juice', 500)).status, 201);
        const s = await summary(juiceUser);
        assert.equal(s.volumeMl, 500);
        assert.equal(s.hydrationMl, 450);
        assert.equal(s.carbsG, 50);
        assert.equal(s.kcal, 225);
    });

    test('a day of 8 waters and a day of 8 colas give different signals', async () => {
        const waterUser = await registerAndLogin(server.baseUrl, 'drinks-water');
        const colaUser = await registerAndLogin(server.baseUrl, 'drinks-cola');
        for (let i = 0; i < 8; i += 1) {
            await log(waterUser, 'water', 250);
            await log(colaUser, 'soft-drink', 250);
        }
        const water = await summary(waterUser);
        const cola = await summary(colaUser);
        assert.equal(water.quality, 'mostly-unsweetened');
        assert.equal(cola.quality, 'mostly-sweetened');
        assert.equal(water.kcal, 0);
        assert.ok(cola.sugarG > 200);
    });

    test('alcohol is reported as grams, not folded into a verdict', async () => {
        const beerUser = await registerAndLogin(server.baseUrl, 'drinks-beer');
        await log(beerUser, 'beer', 500);
        const s = await summary(beerUser);
        assert.equal(s.alcoholG, 19.5);
        assert.ok(s.hydrationMl < 500);
    });

    test('rejects an unknown drink and a bad volume', async () => {
        assert.equal((await log(user, 'lava', 250)).status, 400);
        assert.equal((await log(user, 'water', 0)).status, 400);
        assert.equal((await log(user, 'water', 6000)).status, 400);
        assert.equal((await log(user, 'water', 250.5)).status, 400);
    });

    test('a user only sees and deletes their own drinks', async () => {
        const owner = await registerAndLogin(server.baseUrl, 'drinks-owner');
        const other = await registerAndLogin(server.baseUrl, 'drinks-other');
        const created = await log(owner, 'water', 300);
        const id = (created.body as { id: string }).id;
        assert.equal((await summary(other)).volumeMl, 0);
        assert.equal(
            (await apiRequest(server.baseUrl, `/drink-logs/${id}`, { method: 'DELETE', headers: authHeader(other) })).status,
            404,
        );
        assert.equal(
            (await apiRequest(server.baseUrl, `/drink-logs/${id}`, { method: 'DELETE', headers: authHeader(owner) })).status,
            204,
        );
        assert.equal((await summary(owner)).volumeMl, 0);
    });

    test('limits the range one request may read', async () => {
        const { status } = await apiRequest(
            server.baseUrl,
            `/drink-logs?from=${encodeURIComponent('2026-01-01T00:00:00Z')}&to=${encodeURIComponent('2026-06-01T00:00:00Z')}`,
            { headers: authHeader(user) },
        );
        assert.equal(status, 400);
    });
});
