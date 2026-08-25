import type { Queryable } from '../database/connection.ts';
import type { Discounter, DiscounterCode, DiscounterRow } from '../models/discounter.model.ts';
import { toDiscounter } from '../models/discounter.model.ts';

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
