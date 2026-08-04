// Centralised application configuration (12-factor: read from the environment).
// Every tunable value lives here so the rest of the code never touches process.env.

export const config = {
    /** HTTP port the API listens on. */
    port: Number(process.env.PORT) || 8080,
    /** Runtime environment. */
    nodeEnv: process.env.NODE_ENV ?? 'development',
    /** PostgreSQL connection string. No default — there's no safe one. */
    databaseUrl: process.env.DATABASE_URL,
    /** Secret used to sign session JWTs. No default — there's no safe one. */
    jwtSecret: process.env.JWT_SECRET,
    /** `jsonwebtoken`'s `expiresIn` — a number of seconds, or a vercel/ms string like `1h`. */
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
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
