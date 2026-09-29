import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { config } from '../../src/config/index.ts';
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

// Timing-safe token comparison (H1). config.metricsToken is unset in the
// test environment (.env.test) — mutated directly for this block, the same
// way tests/config/validate-config.test.ts exercises validateConfig(), since
// route.ts reads config.metricsToken per-request, not at import time.
describe('GET /metrics — token check', () => {
    let server: TestServer;
    const REAL_TOKEN = 'a-real-metrics-token';
    const originalMetricsToken = config.metricsToken;

    before(async () => {
        config.metricsToken = REAL_TOKEN;
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
        config.metricsToken = originalMetricsToken;
    });

    test('rejects a token of different length without throwing an unhandled error', async () => {
        const response = await fetch(`${server.baseUrl}/metrics`, {
            headers: { authorization: 'Bearer short' },
        });
        assert.equal(response.status, 401);
        await response.text();
    });

    test('rejects an incorrect same-length token', async () => {
        const wrongSameLength = REAL_TOKEN.slice(0, -1) + (REAL_TOKEN.at(-1) === 'x' ? 'y' : 'x');
        assert.equal(wrongSameLength.length, REAL_TOKEN.length);
        const response = await fetch(`${server.baseUrl}/metrics`, {
            headers: { authorization: `Bearer ${wrongSameLength}` },
        });
        assert.equal(response.status, 401);
        await response.text();
    });

    test('rejects a missing token', async () => {
        const response = await fetch(`${server.baseUrl}/metrics`);
        assert.equal(response.status, 401);
        await response.text();
    });

    test('accepts the correct token', async () => {
        const response = await fetch(`${server.baseUrl}/metrics`, {
            headers: { authorization: `Bearer ${REAL_TOKEN}` },
        });
        assert.equal(response.status, 200);
        await response.text();
    });
});
