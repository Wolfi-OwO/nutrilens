import { z } from 'zod';

export const searchFoodCatalogQuerySchema = z.object({
    q: z.string().min(2).max(100),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(25)).optional().default(10),
});

/** EAN-13 (13 digits) or UPC-A (12 digits) — the two barcode formats Open Food Facts serves. */
export const barcodeFoodCatalogQuerySchema = z.object({
    code: z.string().regex(/^\d{12,13}$/, 'code must be a 12-digit UPC-A or 13-digit EAN-13 barcode'),
});
