import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { loginHandler, logoutHandler } from '../handlers/auth.handlers.ts';
import {
    passkeyAuthenticationOptionsHandler,
    passkeyListHandler,
    passkeyLoginHandler,
    passkeyRegisterHandler,
    passkeyRegistrationOptionsHandler,
    passkeyRemoveHandler,
} from '../handlers/passkey.handlers.ts';
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
import { PasskeyRepository } from '../repository/passkey.repository.ts';
import { TotpRepository } from '../repository/totp.repository.ts';
import { UserRepository } from '../repository/user.repository.ts';
import {
    loginBodySchema,
    passkeyLoginBodySchema,
    passkeyRegisterBodySchema,
    twoFactorCodeBodySchema,
    twoFactorDisableBodySchema,
} from '../schemas/auth.schemas.ts';
import { PasskeyService } from '../services/passkey-service.ts';
import { TotpService } from '../services/totp-service.ts';
import { UserService } from '../services/user-service.ts';

const pool = getPool();
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository, pool);
const totpService = new TotpService(new TotpRepository(pool), userService, userRepository);
const passkeyService = new PasskeyService(new PasskeyRepository(pool), userRepository);

/** The `/auth` endpoints. */
export const authRouter = Router();

authRouter.post(
    '/auth/login',
    loginRateLimiter,
    validateBody(loginBodySchema),
    asyncHandler(loginHandler(userService, totpService)),
);

// Passkeys (WebAuthn): sign in without an email or password, and manage them from the profile.
authRouter.post(
    '/auth/passkey/options',
    loginRateLimiter,
    asyncHandler(passkeyAuthenticationOptionsHandler(passkeyService)),
);
authRouter.post(
    '/auth/passkey/login',
    loginRateLimiter,
    validateBody(passkeyLoginBodySchema),
    asyncHandler(passkeyLoginHandler(passkeyService)),
);
authRouter.get('/users/me/passkeys', requireAuth, asyncHandler(passkeyListHandler(passkeyService)));
authRouter.delete('/users/me/passkeys/:id', requireAuth, asyncHandler(passkeyRemoveHandler(passkeyService)));
authRouter.post(
    '/users/me/passkeys/register/options',
    requireAuth,
    asyncHandler(passkeyRegistrationOptionsHandler(passkeyService)),
);
authRouter.post(
    '/users/me/passkeys/register',
    requireAuth,
    validateBody(passkeyRegisterBodySchema),
    asyncHandler(passkeyRegisterHandler(passkeyService)),
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
