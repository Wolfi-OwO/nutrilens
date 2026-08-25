import type { DatabaseRow } from '../database/connection.ts';

/** The `store_locations` domain shape, as used throughout the application. */
export interface StoreLocation {
    id: string;
    discounterId: string;
    externalStoreId: string | null;
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    /** Decimal degrees, WGS84 — extracted from the `location` geography column. */
    latitude: number;
    longitude: number;
    phone: string | null;
    isActive: boolean;
    lastVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** A {@link StoreLocation} annotated with its distance from a search point, as returned by `findNearby`. */
export interface StoreLocationWithDistance extends StoreLocation {
    distanceKm: number;
}

/**
 * The raw `store_locations` row shape, as returned by pg. `latitude`/`longitude`
 * aren't real columns — every repository query extracts them from the
 * `location` geography column via `ST_Y`/`ST_X`, so callers never handle
 * PostGIS's binary EWKB representation directly.
 */
export interface StoreLocationRow extends DatabaseRow {
    id: string;
    discounter_id: string;
    external_store_id: string | null;
    name: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    latitude: number;
    longitude: number;
    phone: string | null;
    is_active: boolean;
    last_verified_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

/** {@link StoreLocationRow} plus the `distance_km` computed column `findNearby` selects. */
export interface StoreLocationWithDistanceRow extends StoreLocationRow {
    distance_km: number;
}

/**
 * Maps a raw `store_locations` row to the domain {@link StoreLocation} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toStoreLocation(row: StoreLocationRow): StoreLocation {
    return {
        id: row.id,
        discounterId: row.discounter_id,
        externalStoreId: row.external_store_id,
        name: row.name,
        address: row.address,
        city: row.city,
        postalCode: row.postal_code,
        latitude: row.latitude,
        longitude: row.longitude,
        phone: row.phone,
        isActive: row.is_active,
        lastVerifiedAt: row.last_verified_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Maps a raw `findNearby` row (a `store_locations` row plus `distance_km`)
 * to the domain {@link StoreLocationWithDistance} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toStoreLocationWithDistance(
    row: StoreLocationWithDistanceRow,
): StoreLocationWithDistance {
    return {
        ...toStoreLocation(row),
        distanceKm: row.distance_km,
    };
}
