import { z } from 'zod';

/**
 * A discounter `code`, validated by shape rather than against a fixed list.
 *
 * This was `z.enum(['spar', 'billa', 'hofer', 'lidl', 'penny'])` — the five
 * rows migration 0012 seeds. The OpenStreetMap import (issue #212) creates a
 * discounter per brand it finds, taking the table to 31 codes in Austria, so
 * the enum rejected `mpreis` at the HTTP boundary and answered 404 for a
 * chain that has hundreds of stores in `store_locations`. An enum of a
 * reference table's current contents is a deploy away from being wrong; the
 * lookup itself already answers "does this row exist".
 *
 * The pattern is exactly what `slugify()` in scripts/import-osm-supermarkets.ts
 * emits — lowercase alphanumeric segments joined by single hyphens
 * (`nah-frisch`, `billa-plus`, `independent-at`) — so no code the importer can
 * produce is refused here. Bounded at 100 characters because `code` is an
 * unbounded TEXT column and this value reaches a query parameter: parameterised,
 * so not an injection risk, but no reason to hand the database a megabyte.
 */
export const discounterCodeSchema = z
    .string()
    .min(1)
    .max(100)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'code must be lowercase alphanumeric segments separated by single hyphens',
    );

// Structural validation only — which fields are actually editable lives in
// DiscounterRepository#update (code/name/countryCode identify the
// discounter and aren't updatable through this shape).
export const updateDiscounterBodySchema = z.object({
    websiteUrl: z.url().nullable().optional(),
    apiEndpoint: z.url().nullable().optional(),
    dataRefreshFrequencyDays: z.number().int().positive().optional(),
});

/**
 * An ISO 3166-1 alpha-2 country filter. Uppercased on the way in so `?country=at`
 * and `?country=AT` mean the same thing — `discounters.country_code` is CHAR(2)
 * and stores 'AT', and a case mismatch would otherwise read as "no such country"
 * rather than as a typo.
 */
export const countryCodeSchema = z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'country must be an ISO 3166-1 alpha-2 code, e.g. AT')
    .transform((code) => code.toUpperCase());

/** `GET /discounters` — `country` omitted means every country, not none. */
export const listDiscountersQuerySchema = z.object({
    country: countryCodeSchema.optional(),
});

/**
 * `GET /discounters/:code/stores`. Same 25-row ceiling
 * searchFoodCatalogQuerySchema uses, and it matters more here: Billa alone has
 * ~1,067 branches, so an uncapped `limit` is a request for the whole table.
 * `offset` is bounded too — an unbounded one is a free `OFFSET 1e9` sequential
 * scan, and no chain in the table is within three orders of magnitude of it.
 */
export const listDiscounterStoresQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(25).optional().default(25),
    offset: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});
