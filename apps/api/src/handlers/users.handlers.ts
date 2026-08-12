import type { Request, Response } from 'express';
import type { z } from 'zod';

import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import type {
    listUsersQuerySchema,
    registerBodySchema,
    updateProfileBodySchema,
    updateUserRoleStatusBodySchema,
} from '../schemas/users.schemas.ts';
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

/**
 * The `PATCH /users/me` handler — self-service display-name edit. Must be
 * mounted behind `requireAuth` + `validateBody(updateProfileBodySchema)`
 * (see routes/users.routes.ts).
 *
 * @param userService - The service used to validate and apply the change.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function updateProfileHandler(userService: UserService) {
    return async function updateProfile(req: Request, res: Response): Promise<void> {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required.');
        }
        const { displayName } = req.body as z.infer<typeof updateProfileBodySchema>;
        const user = await userService.updateProfile(req.user.sub, displayName);
        res.status(200).json(user);
    };
}

/**
 * The `POST /users/me/avatar` handler. Must be mounted behind `requireAuth`
 * and a multer `single('file')` middleware (see routes/users.routes.ts).
 *
 * @param userService - The service used to normalize and store the upload.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function uploadAvatarHandler(userService: UserService) {
    return async function uploadAvatar(req: Request, res: Response): Promise<void> {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required.');
        }
        if (!req.file) {
            throw new BadRequestError('No image uploaded — expected a multipart "file" field.');
        }
        const user = await userService.setAvatar(req.user.sub, req.file.buffer);
        res.status(200).json(user);
    };
}

/**
 * The `DELETE /users/me/avatar` handler. Must be mounted behind `requireAuth`.
 *
 * @param userService - The service used to clear the upload.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function removeAvatarHandler(userService: UserService) {
    return async function removeAvatar(req: Request, res: Response): Promise<void> {
        if (!req.user) {
            throw new UnauthorizedError('Authentication required.');
        }
        const user = await userService.clearAvatar(req.user.sub);
        res.status(200).json(user);
    };
}

/**
 * The `GET /users/:id/avatar` handler — deliberately unauthenticated (see
 * routes/users.routes.ts's mounting comment): a plain `<img src>` can't
 * send a Bearer token, and two of the three avatar sources are already
 * public provider URLs anyway.
 *
 * @param userService - The service used to fetch the raw image bytes.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getAvatarHandler(userService: UserService) {
    return async function getAvatar(req: Request, res: Response): Promise<void> {
        const bytes = await userService.getAvatarBytes(req.params.id as string);
        if (!bytes) {
            res.status(404).end();
            return;
        }
        res.setHeader('Content-Type', 'image/webp');
        // Private (not a shared CDN cache) since the URL is keyed on an
        // internal user id, not a content hash — a stale cache after a
        // re-upload is a 5-minute annoyance, not a correctness issue.
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.status(200).send(bytes);
    };
}
