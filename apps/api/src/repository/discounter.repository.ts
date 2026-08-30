import type { Queryable } from '../database/connection.ts';
import type {
    Discounter,
    DiscounterCode,
    DiscounterRow,
    DiscounterWithStoreCount,
    DiscounterWithStoreCountRow,
} from '../models/discounter.model.ts';
import { toDiscounter, toDiscounterWithStoreCount } from '../models/discounter.model.ts';

const COLUMNS = [
    'id',
    'code',
    'name',
    'country_code',
    'website_url',
    'api_endpoint',
    'data_refresh_frequency_days',
    'created_at',
    'updated_at',
].join(', ');

export interface UpdateDiscounterInput {
    websiteUrl?: string | null;
    apiEndpoint?: string | null;
    dataRefreshFrequencyDays?: number;
}

export class DiscounterRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /** @returns Every tracked discounter, alphabetical by name. */
    public async findAll(): Promise<Discounter[]> {
        const { rows } = await this.#db.query<DiscounterRow>(
            `SELECT ${COLUMNS} FROM discounters ORDER BY name ASC`,
        );
        return rows.map(toDiscounter);
    }

    /**
     * Every country any discounter is registered in.
     *
     * Read off the data, never a constant: the country list is whatever the
     * imports have put in the table. Today that is `['AT']`; running
     * scripts/import-osm-supermarkets.ts with `--country DE` makes it
     * `['AT', 'DE']` with no code change, and a hardcoded list would have
     * needed a deploy to admit the rows already sitting in the database.
     *
     * @returns The distinct `country_code` values present, alphabetical.
     */
    public async findCountries(): Promise<string[]> {
        const { rows } = await this.#db.query<{ country_code: string }>(
            'SELECT DISTINCT country_code FROM discounters ORDER BY country_code ASC',
        );
        // country_code is CHAR(2), so pg hands back a blank-padded string on
        // any value shorter than two characters. trim() rather than trusting
        // the column width.
        return rows.map((row) => row.country_code.trim());
    }

    /**
     * Discounters with their store counts, optionally narrowed to one country.
     *
     * LEFT JOIN, not an inner one: a discounter with no stores yet (migration
     * 0012 seeds Billa, Hofer, Lidl and Penny as placeholders) must still
     * appear, with `storeCount: 0`, rather than vanishing from the list the UI
     * builds its chain picker from.
     *
     * The `is_active` filter sits in the JOIN condition, not in WHERE — in
     * WHERE it would discard the discounter itself once all its stores were
     * deactivated, turning the LEFT JOIN back into an inner one.
     *
     * One query, one scan, both counts: `FILTER (WHERE source = 'osm')` gets
     * the ODbL share alongside the total instead of a second round trip.
     *
     * @param countryCode - ISO 3166-1 alpha-2 to filter by. Omitted means every
     *   country. An unknown one is not an error — it legitimately has no
     *   discounters, and the caller gets an empty list.
     * @returns Matching discounters with counts, alphabetical by name.
     */
    public async findAllWithStoreCounts(countryCode?: string): Promise<DiscounterWithStoreCount[]> {
        const { rows } = await this.#db.query<DiscounterWithStoreCountRow>(
            `SELECT d.id, d.code, d.name, d.country_code, d.website_url,
                COUNT(s.id) AS store_count,
                COUNT(s.id) FILTER (WHERE s.source = 'osm') AS osm_store_count
            FROM discounters d
            LEFT JOIN store_locations s
                ON s.discounter_id = d.id AND s.is_active = true
            WHERE $1::text IS NULL OR d.country_code = $1
            GROUP BY d.id, d.code, d.name, d.country_code, d.website_url
            ORDER BY d.name ASC`,
            [countryCode ?? null],
        );
        return rows.map(toDiscounterWithStoreCount);
    }

    /**
     * @param id - The discounter id.
     * @returns The matching discounter, or `undefined` if no such discounter exists.
     */
    public async findById(id: string): Promise<Discounter | undefined> {
        const { rows } = await this.#db.query<DiscounterRow>(
            `SELECT ${COLUMNS} FROM discounters WHERE id = $1`,
            [id],
        );
        return rows[0] ? toDiscounter(rows[0]) : undefined;
    }

    /**
     * @param code - The discounter's stable code (e.g. `'spar'`), what
     *   import scripts and other repositories key on rather than the id,
     *   since the id is only known once seeded.
     * @returns The matching discounter, or `undefined` if no such discounter exists.
     */
    public async findByCode(code: DiscounterCode): Promise<Discounter | undefined> {
        const { rows } = await this.#db.query<DiscounterRow>(
            `SELECT ${COLUMNS} FROM discounters WHERE code = $1`,
            [code],
        );
        return rows[0] ? toDiscounter(rows[0]) : undefined;
    }

    /**
     * Applies a partial update to a discounter. Only the fields present in
     * `input` are changed. `code`/`name`/`countryCode` aren't updatable here —
     * they identify the discounter, not describe it.
     *
     * @param id - The discounter to update.
     * @param input - The fields to change.
     * @returns The updated discounter, or `undefined` if no such discounter exists.
     */
    public async update(id: string, input: UpdateDiscounterInput): Promise<Discounter | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.websiteUrl !== undefined) set('website_url', input.websiteUrl);
        if (input.apiEndpoint !== undefined) set('api_endpoint', input.apiEndpoint);
        if (input.dataRefreshFrequencyDays !== undefined)
            set('data_refresh_frequency_days', input.dataRefreshFrequencyDays);

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const { rows } = await this.#db.query<DiscounterRow>(
            `UPDATE discounters SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${COLUMNS}`,
            values,
        );
        return rows[0] ? toDiscounter(rows[0]) : undefined;
    }
}
