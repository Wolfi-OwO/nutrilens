import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AiServerClient } from '../../src/lib/ai-server-client.ts';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function client(fetchImpl: typeof fetch): AiServerClient {
    return new AiServerClient({
        baseUrl: 'http://fake-ai-server',
        timeoutMs: 1000,
        maxRetries: 1,
        circuitBreakerThreshold: 2,
        circuitBreakerCooldownMs: 100,
        fetchImpl,
    });
}

describe('AiServerClient', () => {
    test('a 200 with a well-formed body returns ok', async () => {
        const fakeFetch = (() =>
            Promise.resolve(
                jsonResponse(200, { predictions: [{ label: 'beignets', confidence: 0.99 }], is_confident: true }),
            )) as typeof fetch;

        const result = await client(fakeFetch).predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'ok');
        assert.equal(result.status === 'ok' && result.result.isConfident, true);
    });

    test('a 400 is invalid_image and is not retried', async () => {
        let calls = 0;
        const fakeFetch = (() => {
            calls += 1;
            return Promise.resolve(jsonResponse(400, { detail: 'Uploaded file is not a readable image.' }));
        }) as typeof fetch;

        const result = await client(fakeFetch).predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'invalid_image');
        assert.equal(calls, 1);
    });

    test('a 500 is retried up to maxRetries, then reported unavailable', async () => {
        let calls = 0;
        const fakeFetch = (() => {
            calls += 1;
            return Promise.resolve(jsonResponse(500, {}));
        }) as typeof fetch;

        const result = await client(fakeFetch).predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'unavailable');
        assert.equal(result.status === 'unavailable' && result.reason, 'http_500');
        assert.equal(calls, 2); // 1 attempt + 1 retry
    });

    test('a body missing the expected fields is malformed_response, not a thrown error', async () => {
        const fakeFetch = (() => Promise.resolve(jsonResponse(200, { unexpected: 'shape' }))) as typeof fetch;

        const result = await client(fakeFetch).predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'unavailable');
        assert.equal(result.status === 'unavailable' && result.reason, 'malformed_response');
    });

    test('a network error is unavailable, not a thrown exception', async () => {
        const fakeFetch = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;

        const result = await client(fakeFetch).predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'unavailable');
        assert.equal(result.status === 'unavailable' && result.reason, 'network_error');
    });

    test('a slow response past timeoutMs is reported as a timeout', async () => {
        const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);
                init?.signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
            return jsonResponse(200, { predictions: [], is_confident: false });
        }) as typeof fetch;

        const fastClient = new AiServerClient({
            baseUrl: 'http://fake-ai-server',
            timeoutMs: 50,
            maxRetries: 0,
            circuitBreakerThreshold: 5,
            circuitBreakerCooldownMs: 100,
            fetchImpl: fakeFetch,
        });

        const result = await fastClient.predict(Buffer.from('x'), 'x.jpg', 'image/jpeg');

        assert.equal(result.status, 'unavailable');
        assert.equal(result.status === 'unavailable' && result.reason, 'timeout');
    });

    test('the circuit opens after threshold consecutive failures and stops calling fetch', async () => {
        let calls = 0;
        const fakeFetch = (() => {
            calls += 1;
            return Promise.resolve(jsonResponse(500, {}));
        }) as typeof fetch;

        const breaker = new AiServerClient({
            baseUrl: 'http://fake-ai-server',
            timeoutMs: 1000,
            maxRetries: 0,
            circuitBreakerThreshold: 2,
            circuitBreakerCooldownMs: 60_000,
            fetchImpl: fakeFetch,
        });

        await breaker.predict(Buffer.from('a'), 'a.jpg', 'image/jpeg');
        await breaker.predict(Buffer.from('b'), 'b.jpg', 'image/jpeg');
        const callsBeforeOpen = calls;

        const third = await breaker.predict(Buffer.from('c'), 'c.jpg', 'image/jpeg');

        assert.equal(third.status, 'unavailable');
        assert.equal(third.status === 'unavailable' && third.reason, 'circuit_open');
        assert.equal(calls, callsBeforeOpen); // The third call never reached fetch.
    });

    test('a success after failures resets the failure count', async () => {
        let mode: 'fail' | 'ok' = 'fail';
        const fakeFetch = (() =>
            Promise.resolve(
                mode === 'fail'
                    ? jsonResponse(500, {})
                    : jsonResponse(200, { predictions: [{ label: 'x', confidence: 1 }], is_confident: true }),
            )) as typeof fetch;

        const breaker = new AiServerClient({
            baseUrl: 'http://fake-ai-server',
            timeoutMs: 1000,
            maxRetries: 0,
            circuitBreakerThreshold: 2,
            circuitBreakerCooldownMs: 60_000,
            fetchImpl: fakeFetch,
        });

        await breaker.predict(Buffer.from('a'), 'a.jpg', 'image/jpeg'); // failure 1
        mode = 'ok';
        const recovered = await breaker.predict(Buffer.from('b'), 'b.jpg', 'image/jpeg'); // resets to 0
        assert.equal(recovered.status, 'ok');

        mode = 'fail';
        const afterOneMoreFailure = await breaker.predict(Buffer.from('c'), 'c.jpg', 'image/jpeg');
        // Still just 1 consecutive failure since the reset — threshold 2, so not yet open.
        assert.equal(afterOneMoreFailure.status, 'unavailable');
        assert.equal(afterOneMoreFailure.status === 'unavailable' && afterOneMoreFailure.reason, 'http_500');
    });
});
