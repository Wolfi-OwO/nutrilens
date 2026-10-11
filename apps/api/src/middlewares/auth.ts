import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../lib/errors.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import type { Role } from '../lib/jwt.ts';
import { CSRF_HEADER, CSRF_HEADER_VALUE, SESSION_COOKIE, readCookie } from '../lib/session-cookie.ts';

const BEARER_PREFIX = 'Bearer ';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Authenticates the caller from either the `Authorization: Bearer <token>`
 * header (API clients, tests) or the HttpOnly session cookie (the browser app)
 * and attaches the decoded claims to `req.user`. Mount this before any route
 * (or before {@link requireRole}) that needs to know who's calling.
 *
 * A request authenticated only by the cookie is sent by the browser on its own,
 * including from another site, so a state-changing one must also carry the
 * custom {@link CSRF_HEADER}. A Bearer header is never attached automatically
 * and needs no such check.
 *
 * @param req - The incoming request.
 * @param _res - Unused; failures are forwarded to the error handler.
 * @param next - Called with no argument on success, or an {@link UnauthorizedError}.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header('authorization');
    const bearer = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
    const cookie = bearer === undefined ? readCookie(req, SESSION_COOKIE) : undefined;
    const token = bearer ?? cookie;

    if (!token) {
        next(new UnauthorizedError('Authentication required.'));
        return;
    }

    if (cookie !== undefined && !SAFE_METHODS.has(req.method) && req.header(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
        next(new ForbiddenError('Missing request header.'));
        return;
    }

    try {
        req.user = verifyAccessToken(token);
    } catch {
        next(new UnauthorizedError('Invalid or expired token.'));
        return;
    }

    next();
}

/**
 * Restricts a route to the given roles. Must be mounted after
 * {@link requireAuth} — it trusts `req.user` rather than re-verifying the
 * token, so a route that skips `requireAuth` fails closed (403, not a
 * crash) rather than granting access.
 *
 * @param roles - The roles allowed through.
 * @returns Middleware that forwards a {@link ForbiddenError} for anyone else.
 */
export function requireRole(...roles: Role[]) {
    return function checkRole(req: Request, _res: Response, next: NextFunction): void {
        if (!req.user || !roles.includes(req.user.role)) {
            next(new ForbiddenError('You do not have permission to perform this action.'));
            return;
        }
        next();
    };
}
