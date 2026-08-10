import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// Prometheus exposition format is plain text, not JSON — tests/helpers'
// apiRequest always calls response.json(), so this route needs a raw fetch.
async function getMetrics(baseUrl: string): Promise<{ status: number; body: string }> {
    const response = await fetch(`${baseUrl}/metrics`);
    return { status: response.status, body: await response.text() };
}

describe('GET /metrics', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    // No METRICS_TOKEN is set in the test environment — this is the same
    // "unset means open, local dev/CI never need the real value" shape as
    // INTERNAL_SERVICE_TOKEN.
    test('is reachable with no token configured', async () => {
        const { status, body } = await getMetrics(server.baseUrl);
        assert.equal(status, 200);
        assert.match(body, /http_request_duration_seconds/);
    });

    test('records the request that just happened', async () => {
        await fetch(`${server.baseUrl}/health`);
        const { body } = await getMetrics(server.baseUrl);
        assert.match(body, /route="\/health"/);
        assert.match(body, /status_code="200"/);
    });
});
