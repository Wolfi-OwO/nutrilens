/**
 * Integration tests for the apps/api -> apps/ai-server call path, both the
 * happy path and the failure paths from ADR-0003 — against a real HTTP
 * server standing in for apps/ai-server, not a mocked client. The
 * AiServerClient singleton is constructed once at module-import time (see
 * routes/meal-log.routes.ts), so AI_SERVER_* env vars must be set — and the
 * fake ai-server bound to a real port — before anything that transitively
 * imports config/index.ts is loaded. That's why every import below is
 * dynamic rather than a top-level `import`, and why this is its own file
 * rather than sharing tests/helpers/server-harness.ts's usual pattern.
 *
 * The circuit-breaker threshold here is set high (5) on purpose: this file
 * exercises several distinct failure modes back to back sharing one
 * process-wide client instance, and the point of these tests is each mode
 * individually, not the breaker (see photo-prediction-circuit-breaker.test.ts
 * for that, in its own file/process so its low threshold can't be tripped
 * by anything but its own dedicated calls).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { after, before, describe, test } from 'node:test';

import type { registerAndLogin as RegisterAndLoginFn } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';

type FakeMode = 'ok' | 'not_confident' | 'timeout' | 'error500' | 'invalid400' | 'malformed';

let fakeMode: FakeMode = 'ok';

function startFakeAiServer(): Promise<{ url: string; close: () => Promise<void> }> {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.url !== '/predict' || req.method !== 'POST') {
            res.writeHead(404).end();
            return;
        }
        // Drain the request body — a real client waits for the response
        // regardless, and an unconsumed body can hang the socket.
        req.resume();

        if (fakeMode === 'timeout') {
            // Never responds within the test's short AI_SERVER_TIMEOUT_MS.
            return;
        }
        if (fakeMode === 'error500') {
            res.writeHead(500, { 'content-type': 'application/json' }).end('{}');
            return;
        }
        if (fakeMode === 'invalid400') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ detail: 'Uploaded file is not a readable image.' }));
            return;
        }
        if (fakeMode === 'malformed') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ not: 'the expected shape' }));
            return;
        }

        const body =
            fakeMode === 'not_confident'
                ? { predictions: [{ label: 'unknown_dish', confidence: 0.12 }], is_confident: false }
                : { predictions: [{ label: 'beignets', confidence: 0.999 }], is_confident: true };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
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

describe('meal-logs: photo-prediction (apps/ai-server integration)', () => {
    let fakeAiServer: Awaited<ReturnType<typeof startFakeAiServer>>;
    let server: TestServer;
    let registerAndLogin: typeof RegisterAndLoginFn;
    let apiRequestMultipart: (
        baseUrl: string,
        path: string,
        token: string,
        fileBytes: Buffer,
        filename: string,
    ) => Promise<{ status: number; body: unknown }>;

    before(async () => {
        fakeAiServer = await startFakeAiServer();
        process.env.AI_SERVER_URL = fakeAiServer.url;
        process.env.AI_SERVER_TIMEOUT_MS = '300';
        process.env.AI_SERVER_MAX_RETRIES = '1';
        process.env.AI_SERVER_CIRCUIT_BREAKER_THRESHOLD = '5';
        process.env.AI_SERVER_CIRCUIT_BREAKER_COOLDOWN_MS = '500';

        const serverHarness = await import('../helpers/server-harness.ts');
        const apiClient = await import('../helpers/api-client.ts');
        registerAndLogin = apiClient.registerAndLogin;
        server = await serverHarness.startTestServer();

        apiRequestMultipart = async (baseUrl, path, token, fileBytes, filename) => {
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(fileBytes)], { type: 'image/jpeg' }), filename);
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

    test('happy path: a confident prediction is returned, not persisted as a log', async () => {
        fakeMode = 'ok';
        const user = await registerAndLogin(server.baseUrl, 'photo-ok');

        const { status, body } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 200);
        const result = body as { available: boolean; isConfident: boolean; predictions: unknown[] };
        assert.equal(result.available, true);
        assert.equal(result.isConfident, true);
        assert.equal(result.predictions.length, 1);
    });

    test('a low-confidence prediction still comes back available, flagged not confident', async () => {
        fakeMode = 'not_confident';
        const user = await registerAndLogin(server.baseUrl, 'photo-unsure');

        const { status, body } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 200);
        const result = body as { available: boolean; isConfident: boolean };
        assert.equal(result.available, true);
        assert.equal(result.isConfident, false);
    });

    test('a 400 from apps/ai-server surfaces as a 400, not silently swallowed', async () => {
        fakeMode = 'invalid400';
        const user = await registerAndLogin(server.baseUrl, 'photo-invalid');

        const { status } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 400);
    });

    test('a timeout falls back gracefully — 200 with available: false, never a 500 or a hang', async () => {
        fakeMode = 'timeout';
        const user = await registerAndLogin(server.baseUrl, 'photo-timeout');

        const { status, body } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 200);
        const result = body as { available: boolean; reason: string };
        assert.equal(result.available, false);
        assert.equal(result.reason, 'timeout');
    });

    test('a malformed response body falls back gracefully rather than crashing', async () => {
        fakeMode = 'malformed';
        const user = await registerAndLogin(server.baseUrl, 'photo-malformed');

        const { status, body } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 200);
        const result = body as { available: boolean; reason: string };
        assert.equal(result.available, false);
        assert.equal(result.reason, 'malformed_response');
    });

    test('a 5xx from apps/ai-server falls back gracefully rather than raising a 502', async () => {
        fakeMode = 'error500';
        const user = await registerAndLogin(server.baseUrl, 'photo-500');

        const { status, body } = await apiRequestMultipart(
            server.baseUrl,
            '/meal-logs/photo-prediction',
            user.token,
            Buffer.from('fake-jpeg-bytes'),
            'meal.jpg',
        );

        assert.equal(status, 200);
        const result = body as { available: boolean; reason: string };
        assert.equal(result.available, false);
        assert.equal(result.reason, 'http_500');
    });
});
