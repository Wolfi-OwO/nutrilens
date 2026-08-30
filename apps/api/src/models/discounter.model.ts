import type { DatabaseRow } from '../database/connection.ts';

/**
 * A discounter's stable `code` column.
 *
 * Deliberately `string`, not a literal union. It WAS
 * `'spar' | 'billa' | 'hofer' | 'lidl' | 'penny'` — the five rows migration
 * 0012 seeds — and that stopped being true the moment the OpenStreetMap
 * import (issue #212) landed: it creates a discounter per brand it finds, so
 * the table now holds 31 codes in Austria alone (`mpreis`, `adeg`,
 * `nah-frisch`, `eurospar`, `billa-plus`, `interspar`, `independent-at`, ...)
 * and grows again with every new country extract.
 *
 * The union did not merely under-describe the data, it was load-bearing:
 * mirrored as a `z.enum` in discounter.schemas.ts it rejected `mpreis` at the
 * HTTP boundary, so a real supermarket with real stores in the table answered
 * as if it did not exist. Shape is validated at that boundary instead — see
 * `discounterCodeSchema` — which is where an unknown string is actually
 * dangerous, rather than in a type that must be re-widened on every import.
 */
export type DiscounterCode = string;

/** The `discounters` domain shape, as used throughout the application. */
export interface Discounter {
    id: string;
    code: DiscounterCode;
    name: string;
    countryCode: string;
    websiteUrl: string | null;
    apiEndpoint: string | null;
    dataRefreshFrequencyDays: number;
    createdAt: Date;
    updatedAt: Date;
}

/** The raw `discounters` table row shape (snake_case columns), as returned by pg. */
export interface DiscounterRow extends DatabaseRow {
    id: string;
    code: DiscounterCode;
    name: string;
    country_code: string;
    website_url: string | null;
    api_endpoint: string | null;
    data_refresh_frequency_days: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Maps a raw `discounters` row to the domain {@link Discounter} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toDiscounter(row: DiscounterRow): Discounter {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        countryCode: row.country_code,
        websiteUrl: row.website_url,
        apiEndpoint: row.api_endpoint,
        dataRefreshFrequencyDays: row.data_refresh_frequency_days,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * A {@link Discounter} with how many stores it has, as returned by
 * `DiscounterRepository#findAllWithStoreCounts` — the shape `GET /discounters`
 * serves, so the UI can render "Billa · 1,067 stores" without a request per
 * discounter.
 *
 * `apiEndpoint` is deliberately absent: it is unpopulated and legally gated
 * (issue #186), and this is a client-facing shape.
 */
export interface DiscounterWithStoreCount {
    id: string;
    code: DiscounterCode;
    name: string;
    countryCode: string;
    websiteUrl: string | null;
    /** Active stores only — a deactivated branch is not one a user can shop at. */
    storeCount: number;
    /**
     * How many of `storeCount` came from OpenStreetMap. Not serialised; it is
     * what decides whether the response owes "© OpenStreetMap contributors",
     * since `storeCount` itself is a figure derived from ODbL data whenever
     * this is non-zero.
     */
    osmStoreCount: number;
}

/** The raw row `findAllWithStoreCounts` selects. Counts arrive as strings — `COUNT()` is bigint. */
export interface DiscounterWithStoreCountRow extends DatabaseRow {
    id: string;
    code: DiscounterCode;
    name: string;
    country_code: string;
    website_url: string | null;
    store_count: string;
    osm_store_count: string;
}

/**
 * Maps a raw `findAllWithStoreCounts` row to its domain shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toDiscounterWithStoreCount(
    row: DiscounterWithStoreCountRow,
): DiscounterWithStoreCount {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        countryCode: row.country_code,
        websiteUrl: row.website_url,
        // pg returns bigint as a string to avoid silently truncating past
        // 2^53; these counts are in the thousands, so Number is exact.
        storeCount: Number(row.store_count),
        osmStoreCount: Number(row.osm_store_count),
    };
}
