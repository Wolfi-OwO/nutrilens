import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../lib/errors.ts';
import { verifyAccessToken } from '../lib/jwt.ts';
import type { Role } from '../lib/jwt.ts';

const BEARER_PREFIX = 'Bearer ';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded claims to `req.user`. Mount this before any route (or before
 * {@link requireRole}) that needs to know who's calling.
 *
 * @param req - The incoming request.
 * @param _res - Unused; failures are forwarded to the error handler.
 * @param next - Called with no argument on success, or an {@link UnauthorizedError}.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header('authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
        next(new UnauthorizedError('Authentication required.'));
        return;
    }

    try {
        req.user = verifyAccessToken(header.slice(BEARER_PREFIX.length));
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
