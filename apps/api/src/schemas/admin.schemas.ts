import { z } from 'zod';

// #103 — same page/pageSize shape as listUsersQuerySchema (users.schemas.ts).
export const auditLogQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
