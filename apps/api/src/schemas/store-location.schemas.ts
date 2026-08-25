import { z } from 'zod';

// Structural validation only. Query params arrive as strings, hence the
// coercions — same pattern as searchFoodCatalogQuerySchema.
export const nearbyStoreLocationsQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(100).optional().default(5),
});

/**
 * A single row of the Geolocet Spar dataset (external, purchased CSV —
 * a real trust boundary, unlike the rest of this file's schemas). Column
 * names match scripts/import-geolocet-spar-data.mjs's expected CSV header:
 * `store_id, name, address, city, postal_code, latitude, longitude, phone`.
 * Coerced from strings since every CSV field arrives as one.
 */
export const geolocetStoreRowSchema = z.object({
    store_id: z.string().min(1),
    name: z.string().min(1),
    address: z.string().optional().default(''),
    city: z.string().optional().default(''),
    postal_code: z.string().optional().default(''),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    phone: z.string().optional().default(''),
});
