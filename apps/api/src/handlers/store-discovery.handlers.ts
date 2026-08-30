import type { Request, Response } from 'express';

import { NotFoundError } from '../lib/errors.ts';
import type { StoreLocation, StoreLocationWithDistance } from '../models/store-location.model.ts';
import type { DiscounterRepository } from '../repository/discounter.repository.ts';
import type { StoreLocationRepository } from '../repository/store-location.repository.ts';
import { discounterCodeSchema } from '../schemas/discounter.schemas.ts';

/**
 * The credit ODbL 1.0 obliges us to carry with OpenStreetMap-derived data.
 *
 * The OSMF attribution guideline wants it visible *where the data is shown*,
 * not buried in a legal page, so the API ships it in the same body as the rows
 * it covers: a client physically cannot render these stores without having
 * received the credit. The exact string is the one the guideline specifies —
 * do not shorten it to "OpenStreetMap" or localise it.
 */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/**
 * @param containsOsmData - Whether the response body being built includes
 *   anything derived from OpenStreetMap rows.
 * @returns An `attribution` field, or nothing at all. Absent rather than null
 *   when nothing is owed: the purchased Geolocet data is not ODbL, and
 *   crediting OSM for it would be a false statement about its provenance.
 */
function attributionFor(containsOsmData: boolean): { attribution?: string } {
    return containsOsmData ? { attribution: OSM_ATTRIBUTION } : {};
}

/**
 * A store as a client is allowed to see it.
 *
 * Built by naming every field rather than by deleting a few from the row, so a
 * column added to `store_locations` later cannot leak by default — it has to be
 * added here on purpose. Four fields are withheld, each for its own reason:
 *
 *  - `phone` — NULL on every OSM row, and where a Geolocet row has one it is
 *    frequently a franchise proprietor's private line, not a switchboard.
 *  - `source` — an internal licensing marker (migration 0016). It decides the
 *    `attribution` field above; it is not itself a client's business.
 *  - `externalStoreId` — an OSM element id or a Geolocet key. No meaning to a
 *    user, and publishing the Geolocet keys is publishing part of a purchased
 *    dataset.
 *  - `isActive`/`lastVerifiedAt`/timestamps — bookkeeping; inactive stores are
 *    already filtered out by the queries.
 */
export interface PublicStore {
    id: string;
    discounterId: string;
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number;
    longitude: number;
}

/**
 * @param store - A store row from the repository.
 * @returns The client-safe projection of it.
 */
function toPublicStore(store: StoreLocation): PublicStore {
    return {
        id: store.id,
        discounterId: store.discounterId,
        name: store.name,
        address: store.address,
        city: store.city,
        postalCode: store.postalCode,
        latitude: store.latitude,
        longitude: store.longitude,
    };
}

/**
 * The `GET /discounters/countries` handler. Must be mounted behind `requireAuth`.
 *
 * @param repository - The repository used to read the discounter table.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listDiscounterCountriesHandler(repository: DiscounterRepository) {
    return async function listDiscounterCountries(_req: Request, res: Response): Promise<void> {
        // No attribution here on purpose. The body is a list of ISO country
        // codes — two letters per entry, no OSM content and nothing derived
        // from any single OSM row. Crediting a dataset for the string 'AT'
        // would make the field meaningless everywhere it does matter.
        res.status(200).json(await repository.findCountries());
    };
}

/**
 * The `GET /discounters` handler. Lists discounters with their store counts,
 * optionally narrowed to one country. Must be mounted behind `requireAuth`.
 *
 * @param repository - The repository used to read the discounter table.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listDiscountersHandler(repository: DiscounterRepository) {
    return async function listDiscounters(req: Request, res: Response): Promise<void> {
        const { country } = req.query as { country?: string };
        const discounters = await repository.findAllWithStoreCounts(country);

        res.status(200).json({
            discounters: discounters.map((discounter) => ({
                id: discounter.id,
                code: discounter.code,
                name: discounter.name,
                countryCode: discounter.countryCode,
                websiteUrl: discounter.websiteUrl,
                storeCount: discounter.storeCount,
            })),
            // `storeCount` is a figure computed from OSM rows wherever
            // osmStoreCount > 0 — a number derived from the database still
            // travels with the credit.
            ...attributionFor(discounters.some((d) => d.osmStoreCount > 0)),
        });
    };
}

/**
 * The `GET /discounters/:code/stores` handler. One page of a single
 * discounter's active stores. Must be mounted behind `requireAuth`.
 *
 * @param discounters - The repository used to resolve `:code` to a discounter.
 * @param stores - The repository used to page through its stores.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listDiscounterStoresHandler(
    discounters: DiscounterRepository,
    stores: StoreLocationRepository,
) {
    return async function listDiscounterStores(req: Request, res: Response): Promise<void> {
        // `:code` is a path segment, so `validateQuery` never sees it — checked
        // here instead, and a shape that no `discounters.code` could ever have
        // is the same answer as a code that simply isn't there. The check is
        // about the bound, not the alphabet: the lookup below is parameterised,
        // but an unbounded path segment is an unbounded value handed to the
        // database for nothing.
        const code = discounterCodeSchema.safeParse(req.params.code);
        const discounter = code.success ? await discounters.findByCode(code.data) : undefined;
        if (!discounter) {
            throw new NotFoundError('No such discounter.');
        }

        // Already coerced and bounded by listDiscounterStoresQuerySchema.
        const { limit, offset } = req.query as unknown as { limit: number; offset: number };
        const page = await stores.listByDiscounterPage(discounter.id, limit, offset);

        res.status(200).json({
            stores: page.map(toPublicStore),
            limit,
            offset,
            ...attributionFor(page.some((store) => store.source === 'osm')),
        });
    };
}

/**
 * The `GET /stores/near` handler. Nearest active stores to a point, any
 * discounter. Must be mounted behind `requireAuth`.
 *
 * @param stores - The repository used to run the spatial query.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function nearStoresHandler(stores: StoreLocationRepository) {
    return async function nearStores(req: Request, res: Response): Promise<void> {
        // Already coerced and bounded by nearStoresQuerySchema.
        const query = req.query as unknown as {
            lat: number;
            lon: number;
            radius_m: number;
            limit: number;
        };
        // findNearby's contract is kilometres; the HTTP contract is metres.
        // The conversion lives here, at the single point the two meet.
        const nearby: StoreLocationWithDistance[] = await stores.findNearby(
            query.lat,
            query.lon,
            query.radius_m / 1000,
            query.limit,
        );

        res.status(200).json({
            stores: nearby.map((store) => ({
                ...toPublicStore(store),
                // Rounded to the metre: ST_Distance returns a geodesic double,
                // and sub-metre precision on a store's front door is noise.
                distanceM: Math.round(store.distanceKm * 1000),
            })),
            ...attributionFor(nearby.some((store) => store.source === 'osm')),
        });
    };
}
