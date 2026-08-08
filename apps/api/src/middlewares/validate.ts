import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';

import type { FieldIssue } from '../lib/errors.ts';
import { ValidationError } from '../lib/errors.ts';

/**
 * @param error - The failed parse's error.
 * @returns One {@link FieldIssue} per zod issue, dot-joining the path so a
 *   nested field reads as `items.0.foodName` rather than a raw array.
 */
function toFieldIssues(error: ZodError): FieldIssue[] {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
    }));
}

/**
 * Validates `req.body` against `schema`, replacing it with the parsed
 * (and thus now-typed) result on success. Mount ahead of a handler so the
 * handler can trust its shape instead of re-checking it — issue #24's "no
 * endpoint trusts unvalidated input".
 *
 * @param schema - The schema the request body must satisfy.
 * @returns Middleware that forwards a {@link ValidationError} on failure.
 */
export function validateBody<T>(schema: ZodType<T>) {
    return function validate(req: Request, _res: Response, next: NextFunction): void {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            next(new ValidationError(toFieldIssues(result.error)));
            return;
        }
        req.body = result.data;
        next();
    };
}

/**
 * Validates `req.query` against `schema`, replacing it with the parsed
 * result on success.
 *
 * @param schema - The schema the query string must satisfy.
 * @returns Middleware that forwards a {@link ValidationError} on failure.
 */
export function validateQuery<T>(schema: ZodType<T>) {
    return function validate(req: Request, _res: Response, next: NextFunction): void {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            next(new ValidationError(toFieldIssues(result.error)));
            return;
        }
        req.query = result.data as Request['query'];
        next();
    };
}
