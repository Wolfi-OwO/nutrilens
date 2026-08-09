/**
 * The circuit-breaker half of ADR-0003, split into its own file so it gets
 * its own process (Node's test runner isolates per file) and therefore its
 * own fresh AiServerClient singleton — sharing one with
 * photo-prediction.test.ts's several other failure-mode tests would make
 * the breaker's state (and this test's low threshold) depend on execution
 * order and timing across unrelated tests.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { after, before, describe, test } from 'node:test';

import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';

function startAlwaysFailingAiServer(): Promise<{ url: string; close: () => Promise<void> }> {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        req.resume();
        res.writeHead(500, { 'content-type': 'application/json' }).end('{}');
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (typeof address !== 'object' || address === null) {
                throw new Error('Fake ai-server failed to bind.');
            }
            resolve({
                url: `http://127.0.0.1:${String(address.port)}`,
                close: () => new Promise((res2) => server.close(() => res2())),
            });
        });
    });
}

describe('meal-logs: photo-prediction circuit breaker', () => {
    let fakeAiServer: Awaited<ReturnType<typeof startAlwaysFailingAiServer>>;
    let server: TestServer;
    let user: RegisteredUser;
    let apiRequestMultipart: (baseUrl: string, path: string, token: string) => Promise<{ status: number; body: unknown }>;

    before(async () => {
        fakeAiServer = await startAlwaysFailingAiServer();
        process.env.AI_SERVER_URL = fakeAiServer.url;
        process.env.AI_SERVER_TIMEOUT_MS = '300';
        process.env.AI_SERVER_MAX_RETRIES = '0'; // One attempt per call — every predict() = exactly one recorded failure.
        process.env.AI_SERVER_CIRCUIT_BREAKER_THRESHOLD = '2';
        process.env.AI_SERVER_CIRCUIT_BREAKER_COOLDOWN_MS = '60000'; // Long enough this test can't accidentally outlast it.

        const serverHarness = await import('../helpers/server-harness.ts');
        const apiClient = await import('../helpers/api-client.ts');
        server = await serverHarness.startTestServer();
        user = await apiClient.registerAndLogin(server.baseUrl, 'circuit-breaker');

        apiRequestMultipart = async (baseUrl, path, token) => {
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(Buffer.from('x'))], { type: 'image/jpeg' }), 'x.jpg');
            const response = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const body: unknown = await response.json();
            return { status: response.status, body };
        };
    });

    after(async () => {
        await server.close();
        await fakeAiServer.close();
    });

    test('two consecutive failures open the circuit; a third call fails fast without hitting the network', async () => {
        const first = await apiRequestMultipart(server.baseUrl, '/meal-logs/photo-prediction', user.token);
        assert.equal((first.body as { reason: string }).reason, 'http_500');

        const second = await apiRequestMultipart(server.baseUrl, '/meal-logs/photo-prediction', user.token);
        assert.equal((second.body as { reason: string }).reason, 'http_500');

        // The circuit is now open (threshold 2 reached). This third call
        // must short-circuit to circuit_open, not attempt an HTTP request —
        // the 60s cooldown means it can only get this reason if the
        // breaker logic, not luck, produced it.
        const third = await apiRequestMultipart(server.baseUrl, '/meal-logs/photo-prediction', user.token);
        assert.equal(third.status, 200);
        const result = third.body as { available: boolean; reason: string };
        assert.equal(result.available, false);
        assert.equal(result.reason, 'circuit_open');
    });
});
