import type { Queryable } from '../database/connection.ts';
import type {
    StoreLocation,
    StoreLocationRow,
    StoreLocationWithDistance,
    StoreLocationWithDistanceRow,
} from '../models/store-location.model.ts';
import { toStoreLocation, toStoreLocationWithDistance } from '../models/store-location.model.ts';

// latitude/longitude aren't real columns (see the model) — every SELECT
// extracts them from `location` via ST_Y/ST_X. `::geometry` first: ST_X/ST_Y
// aren't defined for geography, only geometry (which is a lossless cast
// here — SRID 4326 already is what geography stores internally).
const COLUMNS = `
    id, discounter_id, external_store_id, name, address, city, postal_code,
    ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
    phone, source, is_active, last_verified_at, created_at, updated_at`;

export interface CreateStoreLocationInput {
    discounterId: string;
    externalStoreId: string | null;
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number;
    longitude: number;
    phone: string | null;
}

export interface UpdateStoreLocationInput {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    latitude?: number;
    longitude?: number;
    phone?: string | null;
    isActive?: boolean;
    lastVerifiedAt?: Date | null;
}

export class StoreLocationRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param id - The store's id.
     * @returns The matching store, or `undefined` if no such store exists.
     */
    public async findById(id: string): Promise<StoreLocation | undefined> {
        const { rows } = await this.#db.query<StoreLocationRow>(
            `SELECT ${COLUMNS} FROM store_locations WHERE id = $1`,
            [id],
        );
        return rows[0] ? toStoreLocation(rows[0]) : undefined;
    }

    /**
     * @param discounterId - The owning discounter's id.
     * @returns Every store for that discounter, most recently added first.
     */
    public async listByDiscounter(discounterId: string): Promise<StoreLocation[]> {
        const { rows } = await this.#db.query<StoreLocationRow>(
            `SELECT ${COLUMNS} FROM store_locations WHERE discounter_id = $1 ORDER BY created_at DESC`,
            [discounterId],
        );
        return rows.map(toStoreLocation);
    }

    /**
     * One page of a discounter's stores. Separate from {@link listByDiscounter}
     * rather than parameterising it, because the two answer different questions
     * and cannot share an ORDER BY:
     *
     *  - `listByDiscounter` is the admin/import view — every row, including
     *    deactivated ones, newest first.
     *  - this is the public one — active rows only, in a stable order.
     *
     * `created_at DESC` is not a stable order for pagination here. The OSM
     * import (issue #212) inserts a chain's ~1,067 rows inside one statement,
     * so they share a `created_at` to the microsecond; ties break arbitrarily
     * per plan, which silently duplicates and skips rows across pages. Sorting
     * by city then name then `id` ends in a unique column, so every row appears
     * on exactly one page — and reads sensibly in a list, which `created_at`
     * never did.
     *
     * NULLS LAST because `name`/`city` are nullable (OSM elements often carry
     * neither) and Postgres sorts NULLs first ascending by default, which would
     * put the least useful rows on page one.
     *
     * @param discounterId - The owning discounter's id.
     * @param limit - Max rows to return. Bounded by the caller — see
     *   `listDiscounterStoresQuerySchema`.
     * @param offset - Rows to skip.
     * @returns That page of the discounter's active stores.
     */
    public async listByDiscounterPage(
        discounterId: string,
        limit: number,
        offset: number,
    ): Promise<StoreLocation[]> {
        const { rows } = await this.#db.query<StoreLocationRow>(
            `SELECT ${COLUMNS} FROM store_locations
            WHERE discounter_id = $1 AND is_active = true
            ORDER BY city ASC NULLS LAST, name ASC NULLS LAST, id ASC
            LIMIT $2 OFFSET $3`,
            [discounterId, limit, offset],
        );
        return rows.map(toStoreLocation);
    }

    /**
     * Stores within `radiusKm` of a point, nearest first. Backs "discounters
     * near me" (issue #184's `findNearby` requirement, built on for the
     * geolocation feature in issue #185).
     *
     * Uses `ST_DWithin` (not a plain `ST_Distance < x` filter) so the
     * planner can use `idx_store_locations_geo`'s GiST index to prune
     * candidates before computing exact distances — required to hit the
     * <100ms NFR at 1,000+ stores.
     *
     * Measured on 6,615 rows (the volume issue #212's import produces), 5 km
     * around Stephansplatz, LIMIT 25 — `EXPLAIN (ANALYZE, BUFFERS)`:
     *
     *   Bitmap Index Scan on idx_store_locations_geo
     *     Index Cond: (location && _st_expand(..., '5000'::double precision))
     *     rows=6  Buffers: shared hit=2
     *   Execution Time: 5.725 ms
     *
     * Note what the plan does NOT do: the `<->` in ORDER BY is served by an
     * ordinary Sort, not a KNN index scan. The comment here used to claim
     * otherwise. Once ST_DWithin has cut 6,615 rows to 6, sorting them costs
     * nothing and the planner is right to skip the index — the KNN path only
     * pays off when the radius is wide enough to leave a large candidate set,
     * which the endpoint's 50 km cap is there to prevent.
     *
     * @param latitude - Search point latitude, decimal degrees (WGS84).
     * @param longitude - Search point longitude, decimal degrees (WGS84).
     * @param radiusKm - Search radius in kilometers.
     * @param limit - Max results to return. Defaults to 50.
     * @returns Matching, active stores within range, nearest first.
     */
    public async findNearby(
        latitude: number,
        longitude: number,
        radiusKm: number,
        limit = 50,
    ): Promise<StoreLocationWithDistance[]> {
        const { rows } = await this.#db.query<StoreLocationWithDistanceRow>(
            `SELECT ${COLUMNS},
                ST_Distance(location, ST_MakePoint($2, $1)::geography) / 1000 AS distance_km
            FROM store_locations
            WHERE is_active = true
                AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3 * 1000)
            ORDER BY location <-> ST_MakePoint($2, $1)::geography
            LIMIT $4`,
            [latitude, longitude, radiusKm, limit],
        );
        return rows.map(toStoreLocationWithDistance);
    }

    /**
     * @param input - The store's fields.
     * @returns The created store.
     */
    public async create(input: CreateStoreLocationInput): Promise<StoreLocation> {
        const { rows } = await this.#db.query<StoreLocationRow>(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code, location, phone)
            VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($8, $7)::geography, $9)
            RETURNING ${COLUMNS}`,
            [
                input.discounterId,
                input.externalStoreId,
                input.name,
                input.address,
                input.city,
                input.postalCode,
                input.latitude,
                input.longitude,
                input.phone,
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toStoreLocation(row);
    }

    /**
     * Insert-or-update keyed on the `(discounter_id, external_store_id)`
     * unique constraint — what makes re-running a data import (e.g.
     * scripts/import-geolocet-spar-data.mjs) idempotent instead of
     * duplicating every store on every run. `externalStoreId` must be
     * non-null: the constraint's NULLs are never equal, so a null here
     * would always insert.
     *
     * @param input - The store's fields.
     * @returns The created or updated store.
     */
    public async upsertByExternalId(
        input: CreateStoreLocationInput & { externalStoreId: string },
    ): Promise<StoreLocation> {
        const { rows } = await this.#db.query<StoreLocationRow>(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code, location, phone)
            VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($8, $7)::geography, $9)
            ON CONFLICT (discounter_id, external_store_id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                location = EXCLUDED.location,
                phone = EXCLUDED.phone
            RETURNING ${COLUMNS}`,
            [
                input.discounterId,
                input.externalStoreId,
                input.name,
                input.address,
                input.city,
                input.postalCode,
                input.latitude,
                input.longitude,
                input.phone,
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Upsert did not return a row.');
        }
        return toStoreLocation(row);
    }

    /**
     * Applies a partial update to a store. Only the fields present in
     * `input` are changed. `latitude`/`longitude` must be given together —
     * `location` is a single column, so one without the other would
     * overwrite the coordinate that wasn't meant to change.
     *
     * @param id - The store to update.
     * @param input - The fields to change.
     * @returns The updated store, or `undefined` if no such store exists.
     */
    public async update(
        id: string,
        input: UpdateStoreLocationInput,
    ): Promise<StoreLocation | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.name !== undefined) set('name', input.name);
        if (input.address !== undefined) set('address', input.address);
        if (input.city !== undefined) set('city', input.city);
        if (input.postalCode !== undefined) set('postal_code', input.postalCode);
        if (input.phone !== undefined) set('phone', input.phone);
        if (input.isActive !== undefined) set('is_active', input.isActive);
        if (input.lastVerifiedAt !== undefined) set('last_verified_at', input.lastVerifiedAt);
        if (input.latitude !== undefined && input.longitude !== undefined) {
            values.push(input.longitude, input.latitude);
            sets.push(
                `location = ST_MakePoint($${String(values.length - 1)}, $${String(values.length)})::geography`,
            );
        }

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const { rows } = await this.#db.query<StoreLocationRow>(
            `UPDATE store_locations SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${COLUMNS}`,
            values,
        );
        return rows[0] ? toStoreLocation(rows[0]) : undefined;
    }

    /**
     * @param id - The store to delete. Cascades to its `store_opening_hours`.
     * @returns Whether a store was actually deleted.
     */
    public async delete(id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query('DELETE FROM store_locations WHERE id = $1', [
            id,
        ]);
        return (rowCount ?? 0) > 0;
    }
}
