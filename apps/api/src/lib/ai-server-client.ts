// A client for apps/ai-server's /predict, implementing the failure-handling
// flow in organizational/activity-diagrams/ai-server-failure-handling.md: a
// per-attempt timeout, a bounded retry only on transient failures, and a
// circuit breaker that skips the AI path entirely after repeated failures
// rather than piling up slow, doomed requests during an outage. Formalized
// in organizational/adr/0003-ai-server-client-contract.md.

import { config } from '../config/index.ts';

export interface AiPrediction {
    label: string;
    confidence: number;
}

export interface AiPredictResult {
    predictions: AiPrediction[];
    isConfident: boolean;
}

export type AiServerOutcome =
    | { status: 'ok'; result: AiPredictResult }
    /** Timeout, connection failure, 5xx after retries, or the circuit breaker is open. */
    | { status: 'unavailable'; reason: string }
    /** A 400 from apps/ai-server — the image itself is the problem, retrying won't help. */
    | { status: 'invalid_image'; message: string };

export interface AiServerClientOptions {
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
    circuitBreakerThreshold: number;
    circuitBreakerCooldownMs: number;
    /** NFR-SEC-01: sent as X-Internal-Service-Token on every request when set. */
    internalServiceToken?: string | undefined;
    /** Injectable for tests; defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
}

interface PredictResponseBody {
    predictions: AiPrediction[];
    is_confident: boolean;
}

function isPredictResponseBody(value: unknown): value is PredictResponseBody {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as PredictResponseBody).predictions) &&
        typeof (value as PredictResponseBody).is_confident === 'boolean'
    );
}

export class AiServerClient {
    readonly #options: AiServerClientOptions;
    readonly #fetch: typeof fetch;
    #consecutiveFailures = 0;
    #circuitOpenUntil = 0;

    public constructor(options: AiServerClientOptions) {
        this.#options = options;
        this.#fetch = options.fetchImpl ?? fetch;
    }

    /** Never throws — a failure is a typed result, not an exception, so callers can't skip handling it. */
    public async predict(
        imageBytes: Buffer,
        filename: string,
        mimeType: string,
        correlationId?: string,
    ): Promise<AiServerOutcome> {
        if (Date.now() < this.#circuitOpenUntil) {
            return { status: 'unavailable', reason: 'circuit_open' };
        }

        const attempts = 1 + Math.max(0, this.#options.maxRetries);
        let lastReason = 'unknown';

        for (let attempt = 1; attempt <= attempts; attempt++) {
            const outcome = await this.#attempt(imageBytes, filename, mimeType, correlationId);

            if (outcome.status === 'ok' || outcome.status === 'invalid_image') {
                this.#consecutiveFailures = 0;
                return outcome;
            }

            lastReason = outcome.reason;
            // A 4xx-shaped failure would already have returned above as
            // invalid_image — everything reaching here is transient, so a
            // retry (if any attempts remain) is worth trying.
        }

        this.#recordFailure();
        return { status: 'unavailable', reason: lastReason };
    }

    async #attempt(
        imageBytes: Buffer,
        filename: string,
        mimeType: string,
        correlationId?: string,
    ): Promise<AiServerOutcome> {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, this.#options.timeoutMs);

        try {
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array(imageBytes)], { type: mimeType }), filename);

            const headers: Record<string, string> = {};
            if (this.#options.internalServiceToken) {
                headers['X-Internal-Service-Token'] = this.#options.internalServiceToken;
            }
            // issue #63: lets apps/ai-server's logs be joined back to the
            // apps/api request that triggered them.
            if (correlationId) {
                headers['X-Correlation-Id'] = correlationId;
            }

            const response = await this.#fetch(`${this.#options.baseUrl}/predict`, {
                method: 'POST',
                body: form,
                headers,
                signal: controller.signal,
            });

            if (response.status === 400) {
                const body = (await response.json().catch(() => ({}))) as { detail?: string };
                return { status: 'invalid_image', message: body.detail ?? 'Invalid image.' };
            }
            if (!response.ok) {
                return { status: 'unavailable', reason: `http_${String(response.status)}` };
            }

            const body: unknown = await response.json();
            if (!isPredictResponseBody(body)) {
                return { status: 'unavailable', reason: 'malformed_response' };
            }

            return {
                status: 'ok',
                result: { predictions: body.predictions, isConfident: body.is_confident },
            };
        } catch (error) {
            const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error';
            return { status: 'unavailable', reason };
        } finally {
            clearTimeout(timeout);
        }
    }

    #recordFailure(): void {
        this.#consecutiveFailures += 1;
        if (this.#consecutiveFailures >= this.#options.circuitBreakerThreshold) {
            this.#circuitOpenUntil = Date.now() + this.#options.circuitBreakerCooldownMs;
        }
    }
}

let sharedClient: AiServerClient | undefined;

// Mirrors database/connection.ts's getPool(). Returns undefined rather than
// throwing when AI_SERVER_URL isn't set — apps/api must still start and
// serve manual meal logging with no AI server configured at all.
export function getAiServerClient(): AiServerClient | undefined {
    if (!config.aiServerUrl) {
        return undefined;
    }
    if (!sharedClient) {
        sharedClient = new AiServerClient({
            baseUrl: config.aiServerUrl,
            timeoutMs: config.aiServerTimeoutMs,
            maxRetries: config.aiServerMaxRetries,
            circuitBreakerThreshold: config.aiServerCircuitBreakerThreshold,
            circuitBreakerCooldownMs: config.aiServerCircuitBreakerCooldownMs,
            internalServiceToken: config.internalServiceToken,
        });
    }
    return sharedClient;
}
