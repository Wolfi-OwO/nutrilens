import type { Request, Response } from 'express';

import { BadRequestError } from '../lib/errors.ts';
import { signAccessToken } from '../lib/jwt.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * The `POST /auth/login` handler, bound to a `UserService` instance.
 *
 * @param userService - The service used to verify credentials.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function loginHandler(userService: UserService) {
    return async function login(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body as Record<string, unknown>;

        if (typeof email !== 'string' || typeof password !== 'string') {
            throw new BadRequestError('email and password are required strings.');
        }

        const user = await userService.authenticateUser(email, password);
        const token = signAccessToken({ sub: user.id, role: user.role });

        res.status(200).json({ token, user });
    };
}
