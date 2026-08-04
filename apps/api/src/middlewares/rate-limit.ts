import { rateLimit } from 'express-rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

/**
 * Caps login attempts per IP. Flagged by CodeQL as missing on `POST
 * /auth/login`: without it, a client can brute-force a password at network
 * speed since `authenticateUser`'s argon2 check, while slow, is not slow
 * enough to make that infeasible on its own.
 */
export const loginRateLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'TooManyRequestsError',
        message: 'Too many login attempts.',
        statusCode: 429,
    },
});
