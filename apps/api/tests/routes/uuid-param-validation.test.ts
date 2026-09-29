import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// H2 regression: a malformed :id used to reach Postgres verbatim, which threw
// SQLSTATE 22P02 and fell through to an unhandled 500 (leaking the raw driver
// message outside production) — see middlewares/validate.ts's
// validateIdParam(). Every affected route must now answer 404, not 500.
describe('malformed :id params answer 404, not 500', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    // Unauthenticated and reachable by anyone — the highest-priority case
    // named by the review. Uses raw fetch, not apiRequest: a genuinely
    // missing avatar answers with an empty body (see
    // handlers/users.handlers.ts's getAvatarHandler), which apiRequest's
    // always-parse-as-JSON helper can't handle either.
    test('GET /users/not-a-uuid/avatar answers 404', async () => {
        const response = await fetch(`${server.baseUrl}/users/not-a-uuid/avatar`);
        assert.equal(response.status, 404);
        await response.text();
    });

    test('GET /weight-entries/not-a-uuid answers 404, not 500', async () => {
        const user = await registerAndLogin(server.baseUrl, 'uuid-weight-entry');
        const response = await apiRequest(server.baseUrl, '/weight-entries/not-a-uuid', {
            headers: authHeader(user),
        });
        assert.equal(response.status, 404);
    });

    test('GET /meal-logs/not-a-uuid answers 404, not 500', async () => {
        const user = await registerAndLogin(server.baseUrl, 'uuid-meal-log');
        const response = await apiRequest(server.baseUrl, '/meal-logs/not-a-uuid', {
            headers: authHeader(user),
        });
        assert.equal(response.status, 404);
    });

    test('PATCH /diet-plans/not-a-uuid answers 404, not 500', async () => {
        const user = await registerAndLogin(server.baseUrl, 'uuid-diet-plan');
        const response = await apiRequest(server.baseUrl, '/diet-plans/not-a-uuid', {
            method: 'PATCH',
            headers: authHeader(user),
            body: JSON.stringify({ dailyCalorieTarget: 2000 }),
        });
        assert.equal(response.status, 404);
    });
});
