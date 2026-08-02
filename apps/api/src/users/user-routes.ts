import { Router } from 'express';

import { DuplicateEmailError, ValidationError } from './errors.ts';
import type { UserService } from './user-service.ts';

export function createUserRoutes(userService: UserService): Router {
    const router = Router();

    router.post('/users', (req, res, next) => {
        const { email, password, displayName } = req.body as Record<string, unknown>;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            typeof displayName !== 'string'
        ) {
            res.status(400).json({
                error: 'email, password, and displayName are required strings.',
            });
            return;
        }

        userService
            .registerUser({ email, password, displayName })
            .then((user) => {
                res.status(201).json(user);
            })
            .catch((error: unknown) => {
                if (error instanceof ValidationError) {
                    res.status(400).json({ error: error.message });
                    return;
                }
                if (error instanceof DuplicateEmailError) {
                    res.status(409).json({ error: error.message });
                    return;
                }
                next(error);
            });
    });

    return router;
}
