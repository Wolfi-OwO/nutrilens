import type { Request, Response } from 'express';
import type { z } from 'zod';

import { authLoginLinks } from '../lib/hateoas.ts';
import { signAccessToken } from '../lib/jwt.ts';
import { UnauthorizedError } from '../lib/errors.ts';
import { setSessionCookie } from '../lib/session-cookie.ts';
import type { passkeyLoginBodySchema, passkeyRegisterBodySchema } from '../schemas/auth.schemas.ts';
import type { PasskeyService } from '../services/passkey-service.ts';

function userId(req: Request): string {
    if (!req.user) throw new UnauthorizedError('Authentication required.');
    return req.user.sub;
}
const origin = (req: Request): string | undefined => req.header('origin') ?? undefined;

export function passkeyListHandler(service: PasskeyService) {
    return async function list(req: Request, res: Response): Promise<void> {
        res.json({ passkeys: await service.list(userId(req)) });
    };
}

export function passkeyRemoveHandler(service: PasskeyService) {
    return async function remove(req: Request, res: Response): Promise<void> {
        await service.remove(userId(req), String(req.params['id']));
        res.status(204).end();
    };
}

export function passkeyRegistrationOptionsHandler(service: PasskeyService) {
    return async function options(req: Request, res: Response): Promise<void> {
        res.json(await service.registrationOptions(userId(req), origin(req)));
    };
}

export function passkeyRegisterHandler(service: PasskeyService) {
    return async function register(req: Request, res: Response): Promise<void> {
        const { ceremonyId, name, response } = req.body as z.infer<
            typeof passkeyRegisterBodySchema
        >;
        const passkey = await service.finishRegistration(
            userId(req),
            ceremonyId,
            name,
            response as never,
            origin(req),
        );
        res.status(201).json({ passkey });
    };
}

export function passkeyAuthenticationOptionsHandler(service: PasskeyService) {
    return async function options(req: Request, res: Response): Promise<void> {
        res.json(await service.authenticationOptions(origin(req)));
    };
}

/** A passkey with a screen lock or biometric is already two factors, so this does not ask for the two-factor code. */
export function passkeyLoginHandler(service: PasskeyService) {
    return async function login(req: Request, res: Response): Promise<void> {
        const { ceremonyId, response } = req.body as z.infer<typeof passkeyLoginBodySchema>;
        const user = await service.finishAuthentication(ceremonyId, response as never, origin(req));
        const token = signAccessToken({ sub: user.id, role: user.role });
        setSessionCookie(res, token);
        const { passwordHash: _passwordHash, ...publicUser } = user;
        res.status(200).json({ token, user: publicUser, _links: authLoginLinks() });
    };
}
