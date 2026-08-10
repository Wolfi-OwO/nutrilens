import type { Request, Response } from 'express';
import type { z } from 'zod';

import { UnauthorizedError } from '../lib/errors.ts';
import type { listUsersQuerySchema, registerBodySchema, updateUserRoleStatusBodySchema } from '../schemas/users.schemas.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * The `POST /users` handler (registration), bound to a `UserService`
 * instance. Must be mounted behind `validateBody(registerBodySchema)`.
 * Returned as a plain async function, not typed as Express's
 * `RequestHandler` — that type is `void`-only and rejects an async
 * function's `Promise<void>` return; `asyncHandler` (see routes/users.routes.ts)
 * is what bridges the two.
 *
 * @param userService - The service used to validate and create the account.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function registerHandler(userService: UserService) {
    return async function registerUser(req: Request, res: Response): Promise<void> {
        const { email, password, displayName } = req.body as z.infer<typeof registerBodySchema>;
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
 * The `GET /users` handler — search/filter/paginate every account (#100,
 * UC-63). Must be mounted behind `requireAuth` + `requireRole('admin')`
 * and `validateQuery(listUsersQuerySchema)` (see routes/users.routes.ts).
 *
 * @param userService - The service used to search accounts.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listUsersHandler(userService: UserService) {
    return async function listUsers(req: Request, res: Response): Promise<void> {
        const query = req.query as unknown as z.infer<typeof listUsersQuerySchema>;
        const { users, total } = await userService.searchUsers(query);
        res.status(200).json({ users, total, page: query.page, pageSize: query.pageSize });
    };
}

/**
 * The `PATCH /users/:id` handler — change a user's role and/or status
 * (#101, UC-65). Must be mounted behind `requireAuth` + `requireRole('admin')`
 * and `validateBody(updateUserRoleStatusBodySchema)` (see routes/users.routes.ts).
 *
 * @param userService - The service used to apply the change (and its
 *   lockout guards — see `UserService.changeUserRoleStatus`).
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function updateUserRoleStatusHandler(userService: UserService) {
    return async function updateUserRoleStatus(req: Request, res: Response): Promise<void> {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required.');
        }
        const body = req.body as z.infer<typeof updateUserRoleStatusBodySchema>;
        const targetId = req.params.id as string;
        const user = await userService.changeUserRoleStatus(req.user.sub, targetId, body);
        res.status(200).json(user);
    };
}
