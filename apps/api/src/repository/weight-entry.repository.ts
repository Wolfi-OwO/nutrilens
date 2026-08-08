import type { Queryable } from '../database/connection.ts';
import type { WeightEntry, WeightEntryRow } from '../models/weight-entry.model.ts';
import { toWeightEntry } from '../models/weight-entry.model.ts';

const COLUMNS = ['id', 'user_id', 'weight_kg', 'recorded_at', 'created_at'].join(', ');

export interface CreateWeightEntryInput {
    userId: string;
    weightKg: number;
    recordedAt: Date;
    /** UC-41 alt-flow 1a: overwrite the day's existing entry instead of conflicting. */
    overwrite: boolean;
}

export interface UpdateWeightEntryInput {
    weightKg?: number;
    recordedAt?: Date;
}

export class WeightEntryRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param id - The entry id.
     * @returns The matching entry, or `undefined` if no such entry exists.
     */
    public async findById(id: string): Promise<WeightEntry | undefined> {
        const { rows } = await this.#db.query<WeightEntryRow>(
            `SELECT ${COLUMNS} FROM weight_entries WHERE id = $1`,
            [id],
        );
        return rows[0] ? toWeightEntry(rows[0]) : undefined;
    }

    /**
     * The trend query behind UC-40's chart and UC-41's "already logged today"
     * check. `from`/`to` are inclusive UTC dates; either may be omitted for
     * an open-ended range.
     *
     * @param userId - The owning user's id.
     * @param from - The inclusive start of the range, or `undefined` for no lower bound.
     * @param to - The inclusive end of the range, or `undefined` for no upper bound.
     * @returns Matching entries, oldest first.
     */
    public async listByUserInRange(
        userId: string,
        from: Date | undefined,
        to: Date | undefined,
    ): Promise<WeightEntry[]> {
        const conditions = ['user_id = $1'];
        const values: unknown[] = [userId];

        if (from !== undefined) {
            values.push(from);
            conditions.push(`recorded_at >= $${String(values.length)}`);
        }
        if (to !== undefined) {
            values.push(to);
            conditions.push(`recorded_at <= $${String(values.length)}`);
        }

        const { rows } = await this.#db.query<WeightEntryRow>(
            `SELECT ${COLUMNS} FROM weight_entries WHERE ${conditions.join(' AND ')} ORDER BY recorded_at ASC`,
            values,
        );
        return rows.map(toWeightEntry);
    }

    /**
     * @param input - The entry fields. When `overwrite` is `true` and an
     *   entry already exists for that user+day, it's replaced in place
     *   (same id) rather than conflicting — see migration 0001's
     *   `idx_weight_entries_user_day`.
     * @returns The created (or overwritten) entry.
     */
    public async create(input: CreateWeightEntryInput): Promise<WeightEntry> {
        const query = input.overwrite
            ? `INSERT INTO weight_entries (user_id, weight_kg, recorded_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, recorded_date)
               DO UPDATE SET weight_kg = EXCLUDED.weight_kg, recorded_at = EXCLUDED.recorded_at
               RETURNING ${COLUMNS}`
            : `INSERT INTO weight_entries (user_id, weight_kg, recorded_at)
               VALUES ($1, $2, $3)
               RETURNING ${COLUMNS}`;

        const { rows } = await this.#db.query<WeightEntryRow>(query, [
            input.userId,
            input.weightKg,
            input.recordedAt,
        ]);
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toWeightEntry(row);
    }

    /**
     * @param userId - The owning user's id.
     * @param date - A UTC calendar date (only the date part is used).
     * @returns The entry already recorded for that user+day, if any.
     */
    public async findByUserAndDate(userId: string, date: Date): Promise<WeightEntry | undefined> {
        const { rows } = await this.#db.query<WeightEntryRow>(
            `SELECT ${COLUMNS} FROM weight_entries
             WHERE user_id = $1 AND recorded_date = ($2::timestamptz AT TIME ZONE 'UTC')::date`,
            [userId, date],
        );
        return rows[0] ? toWeightEntry(rows[0]) : undefined;
    }

    /**
     * Applies a partial update to an entry. Only the fields present in
     * `input` are changed.
     *
     * @param id - The entry to update.
     * @param input - The fields to change.
     * @returns The updated entry, or `undefined` if no such entry exists.
     */
    public async update(id: string, input: UpdateWeightEntryInput): Promise<WeightEntry | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.weightKg !== undefined) set('weight_kg', input.weightKg);
        if (input.recordedAt !== undefined) set('recorded_at', input.recordedAt);

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const { rows } = await this.#db.query<WeightEntryRow>(
            `UPDATE weight_entries SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${COLUMNS}`,
            values,
        );
        return rows[0] ? toWeightEntry(rows[0]) : undefined;
    }

    /**
     * @param id - The entry to delete.
     * @returns Whether an entry was actually deleted.
     */
    public async delete(id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query('DELETE FROM weight_entries WHERE id = $1', [id]);
        return (rowCount ?? 0) > 0;
    }
}
