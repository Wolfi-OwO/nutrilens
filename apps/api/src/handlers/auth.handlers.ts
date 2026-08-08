import type { Request, Response } from 'express';
import type { z } from 'zod';

import { signAccessToken } from '../lib/jwt.ts';
import type { loginBodySchema } from '../schemas/auth.schemas.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * The `POST /auth/login` handler, bound to a `UserService` instance. Must be
 * mounted behind `validateBody(loginBodySchema)`.
 *
 * @param userService - The service used to verify credentials.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function loginHandler(userService: UserService) {
    return async function login(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body as z.infer<typeof loginBodySchema>;

        const user = await userService.authenticateUser(email, password);
        const token = signAccessToken({ sub: user.id, role: user.role });

        res.status(200).json({ token, user });
    };
}
