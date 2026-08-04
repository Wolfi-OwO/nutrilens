import type { Request, Response } from 'express';

import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * The `POST /users` handler (registration), bound to a `UserService`
 * instance. Returned as a plain async function, not typed as Express's
 * `RequestHandler` — that type is `void`-only and rejects an async
 * function's `Promise<void>` return; `asyncHandler` (see routes/users.routes.ts)
 * is what bridges the two.
 *
 * @param userService - The service used to validate and create the account.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function registerHandler(userService: UserService) {
    return async function registerUser(req: Request, res: Response): Promise<void> {
        const { email, password, displayName } = req.body as Record<string, unknown>;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            typeof displayName !== 'string'
        ) {
            throw new BadRequestError('email, password, and displayName are required strings.');
        }

        const user = await userService.registerUser({ email, password, displayName });
        res.status(201).json(user);
    };
}

/**
 * The `GET /users/me` handler — the caller's own profile. Must be mounted
 * behind `requireAuth` (see routes/users.routes.ts); the `req.user` check
 * here is defense-in-depth, not the primary guard.
 *
 * @param userService - The service used to fetch the account.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getCurrentUserHandler(userService: UserService) {
    return async function getCurrentUser(req: Request, res: Response): Promise<void> {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required.');
        }
        const user = await userService.getUserById(req.user.sub);
        res.status(200).json(user);
    };
}

/**
 * The `GET /users` handler — every account. Must be mounted behind
 * `requireAuth` + `requireRole('admin')` (see routes/users.routes.ts).
 *
 * @param userService - The service used to list accounts.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listUsersHandler(userService: UserService) {
    return async function listUsers(_req: Request, res: Response): Promise<void> {
        const users = await userService.listUsers();
        res.status(200).json(users);
    };
}
