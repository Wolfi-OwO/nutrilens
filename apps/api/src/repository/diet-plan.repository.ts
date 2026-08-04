import type { Queryable } from '../database/connection.ts';
import type { DietPlan, DietPlanGoal, DietPlanRow } from '../models/diet-plan.model.ts';
import { toDietPlan } from '../models/diet-plan.model.ts';

const COLUMNS = [
    'id',
    'user_id',
    'daily_calorie_target',
    'protein_target_grams',
    'carb_target_grams',
    'fat_target_grams',
    'goal',
    'starts_at',
    'ends_at',
    'created_at',
    'updated_at',
].join(', ');

export interface CreateDietPlanInput {
    userId: string;
    dailyCalorieTarget: number;
    proteinTargetGrams: number;
    carbTargetGrams: number;
    fatTargetGrams: number;
    goal: DietPlanGoal;
}

export interface UpdateDietPlanInput {
    dailyCalorieTarget?: number;
    proteinTargetGrams?: number;
    carbTargetGrams?: number;
    fatTargetGrams?: number;
    endsAt?: Date | null;
}

export class DietPlanRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param id - The plan id.
     * @returns The matching plan, or `undefined` if no such plan exists.
     */
    public async findById(id: string): Promise<DietPlan | undefined> {
        const { rows } = await this.#db.query<DietPlanRow>(
            `SELECT ${COLUMNS} FROM diet_plans WHERE id = $1`,
            [id],
        );
        return rows[0] ? toDietPlan(rows[0]) : undefined;
    }

    /**
     * @param userId - The owning user's id.
     * @returns The user's active plan (`ends_at IS NULL`), or `undefined` if
     *   they have none.
     */
    public async findActiveByUser(userId: string): Promise<DietPlan | undefined> {
        const { rows } = await this.#db.query<DietPlanRow>(
            `SELECT ${COLUMNS} FROM diet_plans WHERE user_id = $1 AND ends_at IS NULL`,
            [userId],
        );
        return rows[0] ? toDietPlan(rows[0]) : undefined;
    }

    /**
     * @param userId - The owning user's id.
     * @returns Every plan the user has ever had, most recent first.
     */
    public async listByUser(userId: string): Promise<DietPlan[]> {
        const { rows } = await this.#db.query<DietPlanRow>(
            `SELECT ${COLUMNS} FROM diet_plans WHERE user_id = $1 ORDER BY starts_at DESC`,
            [userId],
        );
        return rows.map(toDietPlan);
    }

    /**
     * Archives whatever plan is currently active for `userId` (if any), then
     * inserts `input` as the new active plan — both in one statement pair so
     * a concurrent request can't observe two active plans at once. Callers
     * that need this atomically with other work should run it inside
     * `DatabaseConnectionPool#transaction` and pass the transaction-scoped
     * client as `db`.
     *
     * @param input - The fields for the new plan.
     * @returns The newly created, now-active plan.
     */
    public async create(input: CreateDietPlanInput): Promise<DietPlan> {
        await this.#db.query('UPDATE diet_plans SET ends_at = now() WHERE user_id = $1 AND ends_at IS NULL', [
            input.userId,
        ]);
        const { rows } = await this.#db.query<DietPlanRow>(
            `INSERT INTO diet_plans (user_id, daily_calorie_target, protein_target_grams, carb_target_grams, fat_target_grams, goal, starts_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())
             RETURNING ${COLUMNS}`,
            [
                input.userId,
                input.dailyCalorieTarget,
                input.proteinTargetGrams,
                input.carbTargetGrams,
                input.fatTargetGrams,
                input.goal,
            ],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toDietPlan(row);
    }

    /**
     * Applies a partial update to a plan. Only the fields present in `input`
     * are changed — per UC-11, historical meal logs keep their original
     * targets, which is why this mutates the plan in place rather than
     * archiving-and-recreating.
     *
     * @param id - The plan to update.
     * @param input - The fields to change.
     * @returns The updated plan, or `undefined` if no such plan exists.
     */
    public async update(id: string, input: UpdateDietPlanInput): Promise<DietPlan | undefined> {
        const sets: string[] = [];
        const values: unknown[] = [];

        function set(column: string, value: unknown): void {
            values.push(value);
            sets.push(`${column} = $${String(values.length)}`);
        }

        if (input.dailyCalorieTarget !== undefined) set('daily_calorie_target', input.dailyCalorieTarget);
        if (input.proteinTargetGrams !== undefined) set('protein_target_grams', input.proteinTargetGrams);
        if (input.carbTargetGrams !== undefined) set('carb_target_grams', input.carbTargetGrams);
        if (input.fatTargetGrams !== undefined) set('fat_target_grams', input.fatTargetGrams);
        if (input.endsAt !== undefined) set('ends_at', input.endsAt);

        if (sets.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const { rows } = await this.#db.query<DietPlanRow>(
            `UPDATE diet_plans SET ${sets.join(', ')} WHERE id = $${String(values.length)} RETURNING ${COLUMNS}`,
            values,
        );
        return rows[0] ? toDietPlan(rows[0]) : undefined;
    }
}
