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

const API_WINDOW_MS = 15 * 60 * 1000;
const API_MAX_REQUESTS = 300;

/**
 * A generous, app-wide cap per IP. `loginRateLimiter` above exists because
 * login specifically needs a much tighter bound; this one exists because
 * CodeQL's missing-rate-limiting query (correctly) flags *every* route that
 * performs an authorization check — `GET /users/me`, `GET /users`, and every
 * protected route still to come (#21-23's DietPlan/MealLog/WeightEntry CRUD,
 * etc.) — and adding a route-scoped limiter to each one as it's built would
 * be the same fix copy-pasted forever. Mounted once, in server.ts, ahead of
 * every route.
 */
export const apiRateLimiter = rateLimit({
    windowMs: API_WINDOW_MS,
    limit: API_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'TooManyRequestsError',
        message: 'Too many requests.',
        statusCode: 429,
    },
});
