import { z } from 'zod';

// Structural validation only. Query params arrive as strings, hence the
// coercions — same pattern as searchFoodCatalogQuerySchema.
//
// The repository-layer contract: StoreLocationRepository#findNearby takes
// kilometres. The HTTP contract below takes metres. Kept separate rather than
// merged because the units genuinely differ at the two layers, and collapsing
// them would mean one of the two silently reinterpreting the other's number.
export const nearbyStoreLocationsQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(100).optional().default(5),
});

/**
 * `GET /stores/near`. Metres, not kilometres — the caller is a map viewport or
 * a browser geolocation fix, both of which think in metres, and an integer
 * metre radius has no rounding to argue about.
 *
 * Both bounds exist to keep the query on `idx_store_locations_geo`'s GiST
 * index. `ST_DWithin` prunes by index only while the radius excludes most of
 * the table; a country-sized radius selects nearly all 6,615 Austrian rows and
 * degrades to a sequential scan plus a full sort. 50 km covers "supermarkets
 * near me" with room to spare, and the 100-row `limit` caps how much the
 * distance sort has to materialise.
 */
export const nearStoresQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius_m: z.coerce.number().int().min(1).max(50_000).optional().default(5_000),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
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
