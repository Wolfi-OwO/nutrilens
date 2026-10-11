import type { Request, Response } from 'express';
import type { z } from 'zod';

import { UnauthorizedError } from '../lib/errors.ts';
import type { twoFactorCodeBodySchema, twoFactorDisableBodySchema } from '../schemas/auth.schemas.ts';
import type { TotpService } from '../services/totp-service.ts';

function userId(req: Request): string {
    if (!req.user) throw new UnauthorizedError('Authentication required.');
    return req.user.sub;
}

/** `GET /users/me/2fa` — whether two-factor is on for the caller. */
export function twoFactorStatusHandler(totp: TotpService) {
    return async function status(req: Request, res: Response): Promise<void> {
        res.status(200).json({ enabled: await totp.isEnabled(userId(req)) });
    };
}

/** `POST /users/me/2fa/setup` — returns a fresh secret and the otpauth URI for the QR code. */
export function twoFactorSetupHandler(totp: TotpService) {
    return async function setup(req: Request, res: Response): Promise<void> {
        res.status(200).json(await totp.beginSetup(userId(req)));
    };
}

/** `POST /users/me/2fa/enable` — confirms a first code; returns the one-time recovery codes. */
export function twoFactorEnableHandler(totp: TotpService) {
    return async function enable(req: Request, res: Response): Promise<void> {
        const { code } = req.body as z.infer<typeof twoFactorCodeBodySchema>;
        res.status(200).json({ recoveryCodes: await totp.enable(userId(req), code) });
    };
}

/** `POST /users/me/2fa/disable` — needs a current code, plus the password when the account has one. */
export function twoFactorDisableHandler(totp: TotpService) {
    return async function disable(req: Request, res: Response): Promise<void> {
        const { code, password } = req.body as z.infer<typeof twoFactorDisableBodySchema>;
        await totp.disable(userId(req), code, password);
        res.status(204).end();
    };
}
