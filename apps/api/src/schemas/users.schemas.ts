import { z } from 'zod';

// Structural validation only — format/length rules stay in UserService.
export const registerBodySchema = z.object({
    email: z.string(),
    password: z.string(),
    displayName: z.string(),
});

const ROLE = z.enum(['user', 'coach', 'admin']);
const STATUS = z.enum(['active', 'suspended', 'deleted']);

// #100 — page/pageSize are capped here (structural: "is this a sane page
// request at all"), not just documented as a convention a caller could
// ignore. Defaults keep GET /users usable with no query string.
export const listUsersQuerySchema = z.object({
    q: z.string().optional(),
    role: ROLE.optional(),
    status: STATUS.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// #101 — "at least one of role/status, and an admin can't set status to
// deleted through this endpoint" is domain reasoning (belongs to
// UserService, mirroring the pattern above), not structural shape, so it's
// not enforced here.
export const updateUserRoleStatusBodySchema = z
    .object({
        role: ROLE.optional(),
        status: z.enum(['active', 'suspended']).optional(),
    })
    .refine((body) => body.role !== undefined || body.status !== undefined, {
        message: 'At least one of role or status must be provided.',
    });

// Structural validation only (like registerBodySchema above) — the
// non-empty-after-trim check stays in UserService.updateProfile.
export const updateProfileBodySchema = z.object({
    displayName: z.string(),
});

// Password confirmation for account deletion (GDPR Art. 17). Required only if
// the account has a password (OAuth-only accounts skip this).
export const deleteAccountBodySchema = z.object({
    password: z.string().optional(),
});
