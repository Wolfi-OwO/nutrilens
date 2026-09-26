import { rateLimit } from 'express-rate-limit';
import { config } from '../config/index.ts';
import { isRateLimitedPath } from '../lib/api-path-segments.ts';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Caps login attempts per IP. Flagged by CodeQL as missing on `POST
 * /auth/login`: without it, a client can brute-force a password at network
 * speed since `authenticateUser`'s argon2 check, while slow, is not slow
 * enough to make that infeasible on its own.
 */
export const loginRateLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: config.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'TooManyRequestsError',
        message: 'Too many login attempts.',
        statusCode: 429,
    },
});

const API_WINDOW_MS = 15 * 60 * 1000;

/**
 * A generous, app-wide cap per IP. `loginRateLimiter` above exists because
 * login specifically needs a much tighter bound; this one exists because
 * CodeQL's missing-rate-limiting query (correctly) flags *every* route that
 * performs an authorization check — `GET /users/me`, `GET /users`, and every
 * protected route still to come (#21-23's DietPlan/MealLog/WeightEntry CRUD,
 * etc.) — and adding a route-scoped limiter to each one as it's built would
 * be the same fix copy-pasted forever. Mounted once, in app.ts, ahead of
 * every route.
 *
 * `skip` exempts anything that isn't a real API path (static assets, the SPA
 * shell, client-side routes served by static-frontend.ts's catch-all) — this
 * limiter runs before mountFrontend() in app.ts, so without the skip, every
 * JS/CSS asset and every page navigation counted against the same 300-req
 * budget as real API calls. A handful of page loads was enough to 429 the
 * app OFF THE PAGE ITSELF, discovered when nutrilens's own e2e suite hit it
 * after ~5 spec files' worth of `page.goto()`s — a real bug, not a test
 * artifact, since a real user's browser makes exactly this shape of traffic.
 *
 * The skip is a matched-list test, not a prefix test, so it has to be
 * exactly as case-insensitive as Express's own routing is — see
 * `isRateLimitedPath`, which is where that (and the previously skipped
 * /admin/* routes) is handled.
 */
export const apiRateLimiter = rateLimit({
    windowMs: API_WINDOW_MS,
    limit: config.apiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !isRateLimitedPath(req.path),
    message: {
        error: 'TooManyRequestsError',
        message: 'Too many requests.',
        statusCode: 429,
    },
});
