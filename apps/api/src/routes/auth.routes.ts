import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { loginHandler } from '../handlers/auth.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { loginRateLimiter } from '../middlewares/rate-limit.ts';
import { UserRepository } from '../repository/user.repository.ts';
import { UserService } from '../services/user-service.ts';

const userRepository = new UserRepository(getPool());
const userService = new UserService(userRepository);

/** The `/auth` endpoints. */
export const authRouter = Router();

authRouter.post('/auth/login', loginRateLimiter, asyncHandler(loginHandler(userService)));
