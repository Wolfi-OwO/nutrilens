import { z } from 'zod';

// Structural validation only — format (a real email shape, minimum password
// length) stays in UserService, which deliberately avoids a regex-based
// email check (ReDoS risk on untrusted input, see user-service.ts).
export const loginBodySchema = z.object({
    email: z.string(),
    password: z.string(),
    /** Authenticator or recovery code; only needed when the account has two-factor on. */
    code: z.string().optional(),
    /** Only on the one retry after a refusal that said legacyLogin: the password as typed. */
    legacyPassword: z.string().optional(),
});

export const twoFactorCodeBodySchema = z.object({ code: z.string() });

export const twoFactorDisableBodySchema = z.object({
    code: z.string(),
    password: z.string().optional(),
    legacyPassword: z.string().optional(),
});

/** The answers come from the browser's WebAuthn API; the library checks their content, this only bounds them. */
const webauthnResponse = z.record(z.string(), z.unknown());
export const passkeyRegisterBodySchema = z.object({
    ceremonyId: z.uuid(),
    name: z.string().trim().max(60).default('Passkey'),
    response: webauthnResponse,
});
export const passkeyLoginBodySchema = z.object({
    ceremonyId: z.uuid(),
    response: webauthnResponse,
});
