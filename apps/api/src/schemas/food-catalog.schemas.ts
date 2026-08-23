import { z } from 'zod';

export const searchFoodCatalogQuerySchema = z.object({
    q: z.string().min(2).max(100),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(25)).optional().default(10),
});
