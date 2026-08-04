import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    getCurrentUserHandler,
    listUsersHandler,
    registerHandler,
} from '../handlers/users.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { UserRepository } from '../repository/user.repository.ts';
import { UserService } from '../services/user-service.ts';

const userRepository = new UserRepository(getPool());
const userService = new UserService(userRepository);

/** The `/users` endpoints. */
export const usersRouter = Router();

usersRouter.post('/users', asyncHandler(registerHandler(userService)));
usersRouter.get('/users/me', requireAuth, asyncHandler(getCurrentUserHandler(userService)));
usersRouter.get(
    '/users',
    requireAuth,
    requireRole('admin'),
    asyncHandler(listUsersHandler(userService)),
);
