import { Router } from 'express';
import multer from 'multer';

import { getPool } from '../database/connection.ts';
import {
    deleteAccountHandler,
    exportDataHandler,
    getAvatarHandler,
    getCurrentUserHandler,
    listUsersHandler,
    registerHandler,
    removeAvatarHandler,
    updateProfileHandler,
    updateUserRoleStatusHandler,
    uploadAvatarHandler,
} from '../handlers/users.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { validateBody, validateQuery } from '../middlewares/validate.ts';
import { UserRepository } from '../repository/user.repository.ts';
import {
    deleteAccountBodySchema,
    listUsersQuerySchema,
    registerBodySchema,
    updateProfileBodySchema,
    updateUserRoleStatusBodySchema,
} from '../schemas/users.schemas.ts';
import { UserService } from '../services/user-service.ts';

const pool = getPool();
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository, pool);

// In-memory only, same pattern as meal-log.routes.ts's photoUpload — never
// spooled to disk. Capped lower (2MB) than the meal-photo upload (10MB):
// an avatar is normalized down to a fixed 256x256 webp regardless of input
// size, so there's no reason to accept anything large.
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

/** The `/users` endpoints. */
export const usersRouter = Router();

usersRouter.post('/users', validateBody(registerBodySchema), asyncHandler(registerHandler(userService)));
usersRouter.get('/users/me', requireAuth, asyncHandler(getCurrentUserHandler(userService)));
// Must be registered BEFORE `PATCH /users/:id`, below — Express matches
// routes in registration order, and `/users/:id` (admin-only) would
// otherwise swallow `/users/me` with :id="me", 403-ing every non-admin
// caller of their own profile-edit endpoint instead of ever reaching this.
usersRouter.patch(
    '/users/me',
    requireAuth,
    validateBody(updateProfileBodySchema),
    asyncHandler(updateProfileHandler(userService)),
);
usersRouter.post(
    '/users/me/avatar',
    requireAuth,
    avatarUpload.single('file'),
    asyncHandler(uploadAvatarHandler(userService)),
);
usersRouter.delete('/users/me/avatar', requireAuth, asyncHandler(removeAvatarHandler(userService)));
// DELETE /users/me (account deletion) and GET /users/me/export must be registered
// BEFORE `PATCH /users/:id` — same ordering reason as `/users/me` above.
usersRouter.delete(
    '/users/me',
    requireAuth,
    validateBody(deleteAccountBodySchema),
    asyncHandler(deleteAccountHandler(userService)),
);
usersRouter.get('/users/me/export', requireAuth, asyncHandler(exportDataHandler(userService)));
usersRouter.get(
    '/users',
    requireAuth,
    requireRole('admin'),
    validateQuery(listUsersQuerySchema),
    asyncHandler(listUsersHandler(userService)),
);
usersRouter.patch(
    '/users/:id',
    requireAuth,
    requireRole('admin'),
    validateBody(updateUserRoleStatusBodySchema),
    asyncHandler(updateUserRoleStatusHandler(userService)),
);
// Public — no requireAuth. Two of the three avatar sources are already
// public, provider-hosted URLs (GitHub/Google), and a plain <img src> can't
// send a Bearer token anyway. User ids are UUIDs, so this exposes at most
// "does this id have an avatar", not an enumerable directory.
usersRouter.get('/users/:id/avatar', asyncHandler(getAvatarHandler(userService)));
