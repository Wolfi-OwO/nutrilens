import type { Queryable } from '../database/connection.ts';
import type { StoreOpeningHour, StoreOpeningHourRow } from '../models/store-opening-hour.model.ts';
import { toStoreOpeningHour } from '../models/store-opening-hour.model.ts';

const COLUMNS = ['id', 'store_id', 'day_of_week', 'opens_at', 'closes_at', 'created_at'].join(', ');

export interface CreateStoreOpeningHourInput {
    storeId: string;
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
}

export class StoreOpeningHourRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param storeId - The owning store's id.
     * @returns That store's opening hours, ordered by day then opening time.
     */
    public async listByStore(storeId: string): Promise<StoreOpeningHour[]> {
        const { rows } = await this.#db.query<StoreOpeningHourRow>(
            `SELECT ${COLUMNS} FROM store_opening_hours WHERE store_id = $1 ORDER BY day_of_week ASC, opens_at ASC`,
            [storeId],
        );
        return rows.map(toStoreOpeningHour);
    }

    /**
     * @param input - The opening-hour span's fields.
     * @returns The created row.
     */
    public async create(input: CreateStoreOpeningHourInput): Promise<StoreOpeningHour> {
        const { rows } = await this.#db.query<StoreOpeningHourRow>(
            `INSERT INTO store_opening_hours (store_id, day_of_week, opens_at, closes_at)
            VALUES ($1, $2, $3, $4)
            RETURNING ${COLUMNS}`,
            [input.storeId, input.dayOfWeek, input.opensAt, input.closesAt],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toStoreOpeningHour(row);
    }

    /**
     * Applies a partial update to an opening-hour span. Only the fields
     * present in `input` are changed.
     *
     * @param id - The row to update.
     * @param input - The fields to change.
     * @returns The updated row, or `undefined` if no such row exists.
     */
    public async update(
        id: string,
        input: Partial<Omit<CreateStoreOpeningHourInput, 'storeId'>>,
    ): Promise<StoreOpeningHour | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.dayOfWeek !== undefined) set('day_of_week', input.dayOfWeek);
        if (input.opensAt !== undefined) set('opens_at', input.opensAt);
        if (input.closesAt !== undefined) set('closes_at', input.closesAt);

        if (sets.length === 0) {
            const { rows } = await this.#db.query<StoreOpeningHourRow>(
                `SELECT ${COLUMNS} FROM store_opening_hours WHERE id = $1`,
                [id],
            );
            return rows[0] ? toStoreOpeningHour(rows[0]) : undefined;
        }

        values.push(id);
        const { rows } = await this.#db.query<StoreOpeningHourRow>(
            `UPDATE store_opening_hours SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${COLUMNS}`,
            values,
        );
        return rows[0] ? toStoreOpeningHour(rows[0]) : undefined;
    }

    /**
     * @param id - The opening-hour row to delete.
     * @returns Whether a row was actually deleted.
     */
    public async delete(id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query('DELETE FROM store_opening_hours WHERE id = $1', [
            id,
        ]);
        return (rowCount ?? 0) > 0;
    }
}
