import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    getCurrentUserHandler,
    listUsersHandler,
    registerHandler,
    updateUserRoleStatusHandler,
} from '../handlers/users.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { validateBody, validateQuery } from '../middlewares/validate.ts';
import { UserRepository } from '../repository/user.repository.ts';
import { listUsersQuerySchema, registerBodySchema, updateUserRoleStatusBodySchema } from '../schemas/users.schemas.ts';
import { UserService } from '../services/user-service.ts';

const pool = getPool();
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository, pool);

/** The `/users` endpoints. */
export const usersRouter = Router();

usersRouter.post('/users', validateBody(registerBodySchema), asyncHandler(registerHandler(userService)));
usersRouter.get('/users/me', requireAuth, asyncHandler(getCurrentUserHandler(userService)));
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
