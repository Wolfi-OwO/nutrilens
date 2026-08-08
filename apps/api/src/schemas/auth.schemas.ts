import { z } from 'zod';

// Structural validation only — format (a real email shape, minimum password
// length) stays in UserService, which deliberately avoids a regex-based
// email check (ReDoS risk on untrusted input, see user-service.ts).
export const loginBodySchema = z.object({
    email: z.string(),
    password: z.string(),
});
