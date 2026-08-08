import { z } from 'zod';

// Structural validation only — format/length rules stay in UserService.
export const registerBodySchema = z.object({
    email: z.string(),
    password: z.string(),
    displayName: z.string(),
});
