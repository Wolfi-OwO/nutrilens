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
        /** Where the OAuth callback redirects the browser back to after a
         * login — fallback only: the handler derives the origin from the
         * request's own Host header (see oauth.handlers.ts), so custom
         * domains layered over the container app keep working. Needed only
         * when a request can reach this app without a Host header. */
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

/** Fail fast on missing required configuration, before server.ts does anything else. */
export function validateConfig(): void {
    if (!config.databaseUrl) {
        throw new Error('DATABASE_URL is not set.');
    }
    if (!config.jwtSecret) {
        throw new Error('JWT_SECRET is not set.');
    }
}
