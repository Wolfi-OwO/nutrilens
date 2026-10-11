import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { loginHandler, logoutHandler } from '../handlers/auth.handlers.ts';
import {
    twoFactorDisableHandler,
    twoFactorEnableHandler,
    twoFactorSetupHandler,
    twoFactorStatusHandler,
} from '../handlers/two-factor.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { loginRateLimiter } from '../middlewares/rate-limit.ts';
import { validateBody } from '../middlewares/validate.ts';
import { TotpRepository } from '../repository/totp.repository.ts';
import { UserRepository } from '../repository/user.repository.ts';
import { loginBodySchema, twoFactorCodeBodySchema, twoFactorDisableBodySchema } from '../schemas/auth.schemas.ts';
import { TotpService } from '../services/totp-service.ts';
import { UserService } from '../services/user-service.ts';

const pool = getPool();
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository, pool);
const totpService = new TotpService(new TotpRepository(pool), userService, userRepository);

/** The `/auth` endpoints. */
export const authRouter = Router();

authRouter.post(
    '/auth/login',
    loginRateLimiter,
    validateBody(loginBodySchema),
    asyncHandler(loginHandler(userService, totpService)),
);

// Two-factor management. The code-checking routes share the login rate limit: a six-digit
// code is guessable by brute force if it is not throttled.
authRouter.get('/users/me/2fa', requireAuth, asyncHandler(twoFactorStatusHandler(totpService)));
authRouter.post('/users/me/2fa/setup', requireAuth, asyncHandler(twoFactorSetupHandler(totpService)));
authRouter.post(
    '/users/me/2fa/enable',
    requireAuth,
    loginRateLimiter,
    validateBody(twoFactorCodeBodySchema),
    asyncHandler(twoFactorEnableHandler(totpService)),
);
authRouter.post(
    '/users/me/2fa/disable',
    requireAuth,
    loginRateLimiter,
    validateBody(twoFactorDisableBodySchema),
    asyncHandler(twoFactorDisableHandler(totpService)),
);

authRouter.post('/auth/logout', logoutHandler());
