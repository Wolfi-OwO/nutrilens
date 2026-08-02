import { Router } from 'express';

import { createRegisterHandler } from '../handlers/users.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * @param userService - The service backing the `/users` handlers.
 * @returns A router mounting the `/users` endpoints.
 */
export function createUserRoutes(userService: UserService): Router {
    const router = Router();

    router.post('/users', asyncHandler(createRegisterHandler(userService)));

    return router;
}
