import type { Request, Response } from 'express';
import type { z } from 'zod';

import { authLoginLinks } from '../lib/hateoas.ts';
import { signAccessToken } from '../lib/jwt.ts';
import { clearSessionCookie, setSessionCookie } from '../lib/session-cookie.ts';
import type { loginBodySchema } from '../schemas/auth.schemas.ts';
import type { TotpService } from '../services/totp-service.ts';
import type { UserService } from '../services/user-service.ts';

/**
 * The `POST /auth/login` handler, bound to a `UserService` instance. Must be
 * mounted behind `validateBody(loginBodySchema)`.
 *
 * @param userService - The service used to verify credentials.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function loginHandler(userService: UserService, totpService: TotpService) {
    return async function login(req: Request, res: Response): Promise<void> {
        const { email, password, code } = req.body as z.infer<typeof loginBodySchema>;

        const user = await userService.authenticateUser(email, password);
        // Only after the password checked out, so a wrong password never reveals
        // whether an account has two-factor on.
        await totpService.assertLoginCode(user.id, code);
        const token = signAccessToken({ sub: user.id, role: user.role });

        // The browser app relies on the cookie and never stores the token; the
        // body copy is for API clients that send it as a Bearer header.
        setSessionCookie(res, token);
        res.status(200).json({ token, user, _links: authLoginLinks() });
    };
}

/**
 * The `POST /auth/logout` handler. The cookie is HttpOnly, so only the server
 * can end the browser session. Bearer tokens are stateless and simply expire.
 *
 * @returns A handler that clears the session cookie.
 */
export function logoutHandler() {
    return function logout(_req: Request, res: Response): void {
        clearSessionCookie(res);
        res.status(204).end();
    };
}
