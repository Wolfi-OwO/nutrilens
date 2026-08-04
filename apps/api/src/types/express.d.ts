import type { AccessTokenPayload } from '../lib/jwt.ts';

// Augments Express's Request with the claims requireAuth (see
// middlewares/auth.ts) attaches after verifying the bearer token. Optional,
// not asserted non-null: a handler mounted without requireAuth in its chain
// must still typecheck as "user may be undefined," not silently assume it.
declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload;
        }
    }
}

export {};
