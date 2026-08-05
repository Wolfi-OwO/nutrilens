import type { Queryable } from '../database/connection.ts';
import type {
    MealLog,
    MealLogItem,
    MealLogItemRow,
    MealLogRow,
    MealLogSource,
} from '../models/meal-log.model.ts';
import { toMealLog, toMealLogItem } from '../models/meal-log.model.ts';

const LOG_COLUMNS = [
    'id',
    'user_id',
    'diet_plan_id',
    'source',
    'logged_at',
    'total_calories',
    'protein_grams',
    'carb_grams',
    'fat_grams',
    'user_corrected',
    'created_at',
    'updated_at',
].join(', ');

const ITEM_COLUMNS = [
    'id',
    'meal_log_id',
    'food_name',
    'portion_grams',
    'confidence',
    'calories',
    'protein_grams',
    'carb_grams',
    'fat_grams',
    'created_at',
].join(', ');

export interface MealLogItemInput {
    foodName: string;
    portionGrams: number;
    confidence: number;
    calories: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
}

export interface CreateMealLogInput {
    userId: string;
    dietPlanId: string;
    source: MealLogSource;
    loggedAt: Date;
    userCorrected: boolean;
    items: MealLogItemInput[];
}

export interface UpdateMealLogInput {
    loggedAt?: Date;
    userCorrected?: boolean;
    /** When present, replaces the log's entire item list and recomputes its totals. */
    items?: MealLogItemInput[];
}

function sumBy(items: MealLogItemInput[], pick: (item: MealLogItemInput) => number): number {
    return items.reduce((total, item) => total + pick(item), 0);
}

export class MealLogRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param mealLogIds - The logs to fetch items for.
     * @returns Every item belonging to any of `mealLogIds`, grouped by log id.
     */
    async #findItemsByLogIds(mealLogIds: string[]): Promise<Map<string, MealLogItem[]>> {
        const grouped = new Map<string, MealLogItem[]>();
        if (mealLogIds.length === 0) {
            return grouped;
        }
        const { rows } = await this.#db.query<MealLogItemRow>(
            `SELECT ${ITEM_COLUMNS} FROM meal_log_items WHERE meal_log_id = ANY($1) ORDER BY created_at`,
            [mealLogIds],
        );
        for (const row of rows) {
            const item = toMealLogItem(row);
            const existing = grouped.get(item.mealLogId);
            if (existing) {
                existing.push(item);
            } else {
                grouped.set(item.mealLogId, [item]);
            }
        }
        return grouped;
    }

    /**
     * @param id - The log id.
     * @returns The matching log with its items, or `undefined` if no such log exists.
     */
    public async findById(id: string): Promise<MealLog | undefined> {
        const { rows } = await this.#db.query<MealLogRow>(
            `SELECT ${LOG_COLUMNS} FROM meal_logs WHERE id = $1`,
            [id],
        );
        const row = rows[0];
        if (!row) {
            return undefined;
        }
        const itemsByLog = await this.#findItemsByLogIds([row.id]);
        return toMealLog(row, itemsByLog.get(row.id) ?? []);
    }

    /**
     * @param userId - The owning user's id.
     * @returns Every log the user has, most recently logged first.
     */
    public async listByUser(userId: string): Promise<MealLog[]> {
        const { rows } = await this.#db.query<MealLogRow>(
            `SELECT ${LOG_COLUMNS} FROM meal_logs WHERE user_id = $1 ORDER BY logged_at DESC`,
            [userId],
        );
        const itemsByLog = await this.#findItemsByLogIds(rows.map((row) => row.id));
        return rows.map((row) => toMealLog(row, itemsByLog.get(row.id) ?? []));
    }

    /**
     * Inserts a meal log and its items. Totals (`total_calories`,
     * `protein_grams`, `carb_grams`, `fat_grams`) are computed here from
     * `input.items`, never taken from the caller directly.
     *
     * @param input - The log and its items.
     * @returns The newly created log, with its items.
     */
    public async create(input: CreateMealLogInput): Promise<MealLog> {
        const { rows } = await this.#db.query<MealLogRow>(
            `INSERT INTO meal_logs (user_id, diet_plan_id, source, logged_at, total_calories, protein_grams, carb_grams, fat_grams, user_corrected)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING ${LOG_COLUMNS}`,
            [
                input.userId,
                input.dietPlanId,
                input.source,
                input.loggedAt,
                sumBy(input.items, (item) => item.calories),
                sumBy(input.items, (item) => item.proteinGrams),
                sumBy(input.items, (item) => item.carbGrams),
                sumBy(input.items, (item) => item.fatGrams),
                input.userCorrected,
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        const items = await this.#insertItems(row.id, input.items);
        return toMealLog(row, items);
    }

    /**
     * @param mealLogId - The log the items belong to.
     * @param items - The items to insert.
     * @returns The inserted items, in insertion order.
     */
    async #insertItems(mealLogId: string, items: MealLogItemInput[]): Promise<MealLogItem[]> {
        const inserted: MealLogItem[] = [];
        for (const item of items) {
            const { rows } = await this.#db.query<MealLogItemRow>(
                `INSERT INTO meal_log_items (meal_log_id, food_name, portion_grams, confidence, calories, protein_grams, carb_grams, fat_grams)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING ${ITEM_COLUMNS}`,
                [
                    mealLogId,
                    item.foodName,
                    item.portionGrams,
                    item.confidence,
                    item.calories,
                    item.proteinGrams,
                    item.carbGrams,
                    item.fatGrams,
                ],
            );
            const row = rows[0];
            if (!row) {
                throw new Error('Insert did not return a row.');
            }
            inserted.push(toMealLogItem(row));
        }
        return inserted;
    }

    /**
     * Applies a partial update. When `input.items` is present, the log's
     * entire item list is replaced and its totals recomputed; other fields
     * are only changed when present.
     *
     * @param id - The log to update.
     * @param input - The fields to change.
     * @returns The updated log with its items, or `undefined` if no such log exists.
     */
    public async update(id: string, input: UpdateMealLogInput): Promise<MealLog | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.loggedAt !== undefined) set('logged_at', input.loggedAt);
        if (input.userCorrected !== undefined) set('user_corrected', input.userCorrected);
        if (input.items !== undefined) {
            set('total_calories', sumBy(input.items, (item) => item.calories));
            set('protein_grams', sumBy(input.items, (item) => item.proteinGrams));
            set('carb_grams', sumBy(input.items, (item) => item.carbGrams));
            set('fat_grams', sumBy(input.items, (item) => item.fatGrams));
        }

        if (input.items !== undefined) {
            await this.#db.query('DELETE FROM meal_log_items WHERE meal_log_id = $1', [id]);
        }

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const { rows } = await this.#db.query<MealLogRow>(
            `UPDATE meal_logs SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${LOG_COLUMNS}`,
            values,
        );
        const row = rows[0];
        if (!row) {
            return undefined;
        }
        const items = input.items !== undefined ? await this.#insertItems(row.id, input.items) : (await this.#findItemsByLogIds([row.id])).get(row.id) ?? [];
        return toMealLog(row, items);
    }

    /**
     * @param id - The log to delete. Its items cascade-delete with it.
     * @returns Whether a log was actually deleted.
     */
    public async delete(id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query('DELETE FROM meal_logs WHERE id = $1', [id]);
        return (rowCount ?? 0) > 0;
    }
}
