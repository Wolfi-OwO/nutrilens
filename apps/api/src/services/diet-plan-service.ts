import type { DatabaseConnectionPool } from '../database/connection.ts';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.ts';
import type { DietPlan, DietPlanGoal } from '../models/diet-plan.model.ts';
import { DietPlanRepository } from '../repository/diet-plan.repository.ts';
import type { UpdateDietPlanInput } from '../repository/diet-plan.repository.ts';

// Sane physiological bounds (UC-10's alt-flow 4a: warn-don't-block in the UI,
// but the API is the last line of defense against a client sending garbage).
const MIN_CALORIE_TARGET = 800;
const MAX_CALORIE_TARGET = 6000;
const MIN_MACRO_GRAMS = 0;
const MAX_MACRO_GRAMS = 600;

const GOALS: readonly DietPlanGoal[] = ['lose_weight', 'maintain', 'gain_weight'];

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION
    );
}

export interface CreateDietPlanInput {
    dailyCalorieTarget: number;
    proteinTargetGrams: number;
    carbTargetGrams: number;
    fatTargetGrams: number;
    goal: string;
}

export interface UpdateDietPlanFields {
    dailyCalorieTarget?: number;
    proteinTargetGrams?: number;
    carbTargetGrams?: number;
    fatTargetGrams?: number;
    endsAt?: string;
}

/**
 * @param value - The candidate goal string from a request body.
 * @returns `value`, narrowed, if it's one of the three recognized goals.
 * @throws {BadRequestError} Otherwise.
 */
function parseGoal(value: string): DietPlanGoal {
    if (!GOALS.includes(value as DietPlanGoal)) {
        throw new BadRequestError(`goal must be one of: ${GOALS.join(', ')}.`);
    }
    return value as DietPlanGoal;
}

/**
 * @param field - The field name, for the error message.
 * @param value - The candidate value.
 * @param min - The inclusive lower bound.
 * @param max - The inclusive upper bound.
 * @throws {BadRequestError} If `value` isn't a finite number within range.
 */
function assertInRange(field: string, value: number, min: number, max: number): void {
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new BadRequestError(`${field} must be a number between ${String(min)} and ${String(max)}.`);
    }
}

export class DietPlanService {
    readonly #repository: DietPlanRepository;
    readonly #pool: DatabaseConnectionPool;

    /**
     * @param repository - The data-access layer for the `diet_plans` table.
     * @param pool - The connection pool, used to run `createPlan` in a
     *   transaction (see {@link DietPlanRepository.create}'s doc comment).
     */
    public constructor(repository: DietPlanRepository, pool: DatabaseConnectionPool) {
        this.#repository = repository;
        this.#pool = pool;
    }

    /**
     * Validates targets, then creates a new active plan for `userId`,
     * archiving whatever plan was previously active (UC-10 step 5).
     *
     * @param userId - The owning user's id.
     * @param input - The plan fields from the request body.
     * @returns The newly created plan.
     * @throws {BadRequestError} If any field fails validation.
     * @throws {ConflictError} If a concurrent request already created an
     *   active plan for this user (see migration 0002).
     */
    public async createPlan(userId: string, input: CreateDietPlanInput): Promise<DietPlan> {
        const goal = parseGoal(input.goal);
        assertInRange('dailyCalorieTarget', input.dailyCalorieTarget, MIN_CALORIE_TARGET, MAX_CALORIE_TARGET);
        assertInRange('proteinTargetGrams', input.proteinTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);
        assertInRange('carbTargetGrams', input.carbTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);
        assertInRange('fatTargetGrams', input.fatTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);

        try {
            return await this.#pool.transaction(async (client) => {
                const transactionalRepository = new DietPlanRepository(client);
                return transactionalRepository.create({
                    userId,
                    dailyCalorieTarget: input.dailyCalorieTarget,
                    proteinTargetGrams: input.proteinTargetGrams,
                    carbTargetGrams: input.carbTargetGrams,
                    fatTargetGrams: input.fatTargetGrams,
                    goal,
                });
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError('An active diet plan was just created for this user.');
            }
            throw error;
        }
    }

    /**
     * @param userId - The owning user's id.
     * @returns The user's active plan.
     * @throws {NotFoundError} If they have no active plan.
     */
    public async getActivePlan(userId: string): Promise<DietPlan> {
        const plan = await this.#repository.findActiveByUser(userId);
        if (!plan) {
            throw new NotFoundError('No active diet plan.');
        }
        return plan;
    }

    /**
     * @param userId - The owning user's id.
     * @returns Every plan the user has had, most recent first.
     */
    public async listPlans(userId: string): Promise<DietPlan[]> {
        return this.#repository.listByUser(userId);
    }

    /**
     * Applies a partial update to a plan, after checking `requester` is
     * either the plan's owner or an admin.
     *
     * @param planId - The plan to update.
     * @param requester - The authenticated caller (id + role).
     * @param fields - The fields to change.
     * @returns The updated plan.
     * @throws {NotFoundError} If no such plan exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     * @throws {BadRequestError} If any provided field fails validation.
     */
    public async updatePlan(
        planId: string,
        requester: { id: string; role: string },
        fields: UpdateDietPlanFields,
    ): Promise<DietPlan> {
        const plan = await this.#requireOwnedPlan(planId, requester);

        const update: UpdateDietPlanInput = {};
        if (fields.dailyCalorieTarget !== undefined) {
            assertInRange('dailyCalorieTarget', fields.dailyCalorieTarget, MIN_CALORIE_TARGET, MAX_CALORIE_TARGET);
            update.dailyCalorieTarget = fields.dailyCalorieTarget;
        }
        if (fields.proteinTargetGrams !== undefined) {
            assertInRange('proteinTargetGrams', fields.proteinTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);
            update.proteinTargetGrams = fields.proteinTargetGrams;
        }
        if (fields.carbTargetGrams !== undefined) {
            assertInRange('carbTargetGrams', fields.carbTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);
            update.carbTargetGrams = fields.carbTargetGrams;
        }
        if (fields.fatTargetGrams !== undefined) {
            assertInRange('fatTargetGrams', fields.fatTargetGrams, MIN_MACRO_GRAMS, MAX_MACRO_GRAMS);
            update.fatTargetGrams = fields.fatTargetGrams;
        }
        if (fields.endsAt !== undefined) {
            const endsAt = new Date(fields.endsAt);
            if (Number.isNaN(endsAt.getTime())) {
                throw new BadRequestError('endsAt must be a valid date.');
            }
            if (endsAt <= plan.startsAt) {
                throw new BadRequestError('endsAt must be after startsAt.');
            }
            update.endsAt = endsAt;
        }

        const updated = await this.#repository.update(planId, update);
        if (!updated) {
            throw new NotFoundError('Diet plan not found.');
        }
        return updated;
    }

    /**
     * Ends a plan (UC-12) by setting its `endsAt` to now, after checking
     * `requester` is either the plan's owner or an admin.
     *
     * @param planId - The plan to archive.
     * @param requester - The authenticated caller (id + role).
     * @returns The archived plan.
     * @throws {NotFoundError} If no such plan exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     * @throws {ConflictError} If the plan is already archived.
     */
    public async archivePlan(planId: string, requester: { id: string; role: string }): Promise<DietPlan> {
        const plan = await this.#requireOwnedPlan(planId, requester);
        if (plan.endsAt !== null) {
            throw new ConflictError('This plan is already archived.');
        }
        const updated = await this.#repository.update(planId, { endsAt: new Date() });
        if (!updated) {
            throw new NotFoundError('Diet plan not found.');
        }
        return updated;
    }

    /**
     * @param planId - The plan to look up.
     * @param requester - The authenticated caller (id + role).
     * @returns The plan, once ownership is confirmed.
     * @throws {NotFoundError} If no such plan exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     */
    async #requireOwnedPlan(planId: string, requester: { id: string; role: string }): Promise<DietPlan> {
        const plan = await this.#repository.findById(planId);
        if (!plan) {
            throw new NotFoundError('Diet plan not found.');
        }
        if (plan.userId !== requester.id && requester.role !== 'admin') {
            throw new ForbiddenError('You do not have permission to modify this diet plan.');
        }
        return plan;
    }
}
