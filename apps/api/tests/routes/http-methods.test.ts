import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// Regression for the pre-fix behaviour: cors() answered every OPTIONS with a
// blanket 204 and no Allow header, even for a path that doesn't exist. These
// use raw fetch (not apiRequest) — HEAD/OPTIONS responses have no JSON body
// for apiRequest's response.json() call to parse.
describe('HEAD and OPTIONS', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('HEAD /version answers 200 with an empty body', async () => {
        const response = await fetch(`${server.baseUrl}/version`, { method: 'HEAD' });
        assert.equal(response.status, 200);
        assert.equal((await response.text()).length, 0);
    });

    test('OPTIONS /meal-logs lists its real methods', async () => {
        const response = await fetch(`${server.baseUrl}/meal-logs`, { method: 'OPTIONS' });
        const allow = response.headers.get('allow') ?? '';
        assert.equal(response.status, 200);
        assert.ok(allow.includes('GET'));
        assert.ok(allow.includes('HEAD'));
        assert.ok(allow.includes('POST'));
    });

    test('OPTIONS /meal-logs/x lists its real methods', async () => {
        const response = await fetch(`${server.baseUrl}/meal-logs/x`, { method: 'OPTIONS' });
        const allow = response.headers.get('allow') ?? '';
        assert.equal(response.status, 200);
        assert.ok(allow.includes('GET'));
        assert.ok(allow.includes('PATCH'));
        assert.ok(allow.includes('DELETE'));
    });

    test('OPTIONS on a path that does not exist is a real 404, not a blanket 204', async () => {
        const response = await fetch(`${server.baseUrl}/does-not-exist`, { method: 'OPTIONS' });
        assert.equal(response.status, 404);
        const body = (await response.json()) as { error: string };
        assert.equal(body.error, 'NotFoundError');
    });

    test('a real CORS preflight still gets Access-Control-Allow-Origin', async () => {
        const response = await fetch(`${server.baseUrl}/meal-logs`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
            },
        });
        assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    });
});
