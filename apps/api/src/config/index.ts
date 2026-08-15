// Centralised application configuration (12-factor: read from the environment).
// Every tunable value lives here so the rest of the code never touches process.env.

export const config = {
    /** HTTP port the API listens on. */
    port: Number(process.env.PORT) || 8080,
    /** Runtime environment. */
    nodeEnv: process.env.NODE_ENV ?? 'development',
    /** pino's level names: trace/debug/info/warn/error/fatal/silent. Issue #61. */
    logLevel: process.env.LOG_LEVEL ?? 'info',
    /** Issue #64: gates GET /metrics. Optional, mirroring internalServiceToken below. */
    metricsToken: process.env.METRICS_TOKEN,
    /** PostgreSQL connection string. No default — there's no safe one. */
    databaseUrl: process.env.DATABASE_URL,
    /** Secret used to sign session JWTs. No default — there's no safe one. */
    jwtSecret: process.env.JWT_SECRET,
    /** `jsonwebtoken`'s `expiresIn` — a number of seconds, or a vercel/ms string like `1h`. */
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    /**
     * Browser origins allowed to call this API cross-origin, comma-separated.
     * No default — `cors()` with no options answers every origin with
     * `Access-Control-Allow-Origin: *`, which is what this replaced.
     * Production serves the frontend same-origin (static-frontend.ts), where
     * CORS never applies at all; this exists for the split-origin setups
     * (local `npm run dev` on :5173, a preview deployment) that do need it.
     */
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),

    // Optional — manual meal logging works with none of this set; only the
    // photo-prediction path needs it. See
    // organizational/adr/0003-ai-server-client-contract.md.
    /** Base URL of the internal-only AI-detection service. No default. */
    aiServerUrl: process.env.AI_SERVER_URL,
    /** NFR-SEC-01: shared secret sent as X-Internal-Service-Token on every
     * ai-server request — defense in depth on top of network isolation.
     * Optional, mirroring ai-server's own config.py: unset in local dev. */
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
    /** Per-attempt request timeout — NFR-PERF-01's 3s p95 budget is the whole round trip, so this must be under that. */
    aiServerTimeoutMs: Number(process.env.AI_SERVER_TIMEOUT_MS) || 2500,
    /** Retries on a transient failure (timeout, connection error, 5xx) — not retried on a 4xx (e.g. a malformed image). */
    aiServerMaxRetries: Number(process.env.AI_SERVER_MAX_RETRIES) || 1,
    /** Consecutive failures before the circuit breaker opens and skips the AI path entirely. */
    aiServerCircuitBreakerThreshold: Number(process.env.AI_SERVER_CIRCUIT_BREAKER_THRESHOLD) || 5,
    /** How long the circuit stays open before allowing another attempt. */
    aiServerCircuitBreakerCooldownMs: Number(process.env.AI_SERVER_CIRCUIT_BREAKER_COOLDOWN_MS) || 30_000,

    /** App-wide per-IP request cap (middlewares/rate-limit.ts). 300/15min fits
     * one real browsing session comfortably; an e2e suite creating dozens of
     * accounts from one source IP does not, so this is configurable rather
     * than a magic number the e2e workflow would otherwise need to work around. */
    apiRateLimitMax: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    /** POST /auth/login cap per IP (middlewares/rate-limit.ts) — tight on
     * purpose (anti-brute-force), which is exactly why an e2e suite hits it:
     * register() logs in right after creating the account, so N test
     * registrations is N logins against a 10/15min budget meant for one
     * human, not a same-IP test run. Configurable for the same reason as
     * apiRateLimitMax above. */
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,

    // OAuth login (issue #153) — each provider is fully optional. A provider
    // with no client id/secret set simply doesn't appear as a login option
    // (see oauth-providers.ts's isProviderConfigured), rather than the
    // server refusing to start — local dev and CI never need real OAuth apps.
    oauth: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        },
        /** Where the callback route sends the browser after a successful
         * login — the frontend's own origin, since apps/api serves it
         * same-origin in every real deployment (see static-frontend.ts). No
         * default: without it, redirect URIs can't be built correctly. */
        frontendBaseUrl: process.env.OAUTH_FRONTEND_BASE_URL,
    },

    // Stamped into the image by the Dockerfile's OCI labels/build-args (see
    // GET /version and apps/frontend's footer) — 'dev' outside a real build.
    buildInfo: {
        version: process.env.APP_VERSION ?? 'dev',
        revision: process.env.APP_REVISION ?? '',
        buildDate: process.env.APP_BUILD_DATE ?? '',
        repositoryUrl: process.env.APP_REPOSITORY_URL ?? 'https://github.com/Wolfi-OwO/nutrilens',
    },
};

export const isProduction = config.nodeEnv === 'production';

/**
 * A 256-bit secret, expressed as characters. `openssl rand -base64 48` (what
 * .env.example tells you to run) produces 64, so this rejects only
 * hand-typed secrets — the ones an HS256 signature can actually be
 * brute-forced back out of offline, since every token this API issues is a
 * free plaintext/signature pair to attack.
 */
const MIN_JWT_SECRET_LENGTH = 32;

/** Fail fast on missing required configuration, before server.ts does anything else. */
export function validateConfig(): void {
    if (!config.databaseUrl) {
        throw new Error('DATABASE_URL is not set.');
    }
    if (!config.jwtSecret) {
        throw new Error('JWT_SECRET is not set.');
    }
    if (config.jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(
            `JWT_SECRET must be at least ${String(MIN_JWT_SECRET_LENGTH)} characters — generate one with \`openssl rand -base64 48\`.`,
        );
    }
    if (config.corsAllowedOrigins.length === 0) {
        throw new Error(
            'CORS_ALLOWED_ORIGINS is not set. Set it to this deployment\'s own frontend origin (comma-separated for more than one); "*" is not accepted.',
        );
    }
    if (config.corsAllowedOrigins.includes('*')) {
        throw new Error('CORS_ALLOWED_ORIGINS must list real origins — "*" would restore the wildcard this replaced.');
    }
}
