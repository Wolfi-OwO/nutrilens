import type { NextFunction, Request, Response } from 'express';

import { isProduction } from '../config/index.ts';
import { AppError, NotFoundError } from '../lib/errors.ts';

/**
 * Catch-all for unmatched routes -> forwards a 404 to the error handler.
 *
 * @param req - The incoming request.
 * @param _res - Unused; the error handler owns the response.
 * @param next - Forwards the generated {@link NotFoundError}.
 */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

/**
 * Centralised error handler — maps AppError instances to their status code
 * and keeps internal (5xx) details out of client responses in production.
 *
 * @param err - The thrown or rejected value, from any upstream handler.
 * @param _req - Unused.
 * @param res - Used to send the mapped status code and JSON error body.
 * @param _next - Unused; this is the terminal handler in the chain.
 */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.name,
            message: err.expose || !isProduction ? err.message : 'Internal Server Error',
            statusCode: err.statusCode,
        });
        return;
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({
        error: 'InternalServerError',
        message: isProduction ? 'Internal Server Error' : message,
        statusCode: 500,
    });
}
