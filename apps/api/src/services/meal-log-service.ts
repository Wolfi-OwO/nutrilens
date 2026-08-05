import type { DatabaseConnectionPool } from '../database/connection.ts';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.ts';
import type { MealLog, MealLogSource } from '../models/meal-log.model.ts';
import type { DietPlanRepository } from '../repository/diet-plan.repository.ts';
import { MealLogRepository } from '../repository/meal-log.repository.ts';
import type { MealLogItemInput, UpdateMealLogInput } from '../repository/meal-log.repository.ts';

const SOURCES: readonly MealLogSource[] = ['ai_photo', 'manual_search', 'barcode'];
const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 1;

export interface MealLogItemFields {
    foodName: string;
    portionGrams: number;
    confidence?: number;
    calories: number;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
}

export interface CreateMealLogFields {
    source: string;
    loggedAt?: string;
    userCorrected?: boolean;
    items: MealLogItemFields[];
}

export interface UpdateMealLogFields {
    loggedAt?: string;
    userCorrected?: boolean;
    items?: MealLogItemFields[];
}

/**
 * @param field - The field name, for the error message.
 * @param value - The candidate value.
 * @throws {BadRequestError} If `value` isn't a non-negative finite integer.
 */
function assertNonNegativeInteger(field: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new BadRequestError(`${field} must be a non-negative whole number.`);
    }
}

/**
 * @param items - The raw item fields from a request body.
 * @returns Validated, normalized items ready for the repository.
 * @throws {BadRequestError} If the list is empty or any item fails validation.
 */
function parseItems(items: MealLogItemFields[]): MealLogItemInput[] {
    if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestError('items must be a non-empty array.');
    }
    return items.map((item, index) => {
        const label = `items[${String(index)}]`;
        const foodName = item.foodName?.trim();
        if (!foodName) {
            throw new BadRequestError(`${label}.foodName is required.`);
        }
        if (!Number.isFinite(item.portionGrams) || item.portionGrams <= 0) {
            throw new BadRequestError(`${label}.portionGrams must be a positive number.`);
        }
        const confidence = item.confidence ?? 1;
        if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE || confidence > MAX_CONFIDENCE) {
            throw new BadRequestError(`${label}.confidence must be a number between 0 and 1.`);
        }
        assertNonNegativeInteger(`${label}.calories`, item.calories);
        const proteinGrams = item.proteinGrams ?? 0;
        const carbGrams = item.carbGrams ?? 0;
        const fatGrams = item.fatGrams ?? 0;
        assertNonNegativeInteger(`${label}.proteinGrams`, proteinGrams);
        assertNonNegativeInteger(`${label}.carbGrams`, carbGrams);
        assertNonNegativeInteger(`${label}.fatGrams`, fatGrams);
        return {
            foodName,
            portionGrams: item.portionGrams,
            confidence,
            calories: item.calories,
            proteinGrams,
            carbGrams,
            fatGrams,
        };
    });
}

/**
 * @param value - The candidate source string.
 * @returns `value`, narrowed, if it's a recognized source.
 * @throws {BadRequestError} Otherwise.
 */
function parseSource(value: string): MealLogSource {
    if (!SOURCES.includes(value as MealLogSource)) {
        throw new BadRequestError(`source must be one of: ${SOURCES.join(', ')}.`);
    }
    return value as MealLogSource;
}

/**
 * @param value - The candidate ISO date string.
 * @returns The parsed date, or `undefined` if `value` is `undefined`.
 * @throws {BadRequestError} If `value` is present but not a valid date.
 */
function parseOptionalDate(value: string | undefined): Date | undefined {
    if (value === undefined) {
        return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('loggedAt must be a valid date.');
    }
    return date;
}

export class MealLogService {
    readonly #repository: MealLogRepository;
    readonly #dietPlanRepository: DietPlanRepository;
    readonly #pool: DatabaseConnectionPool;

    /**
     * @param repository - The data-access layer for `meal_logs`/`meal_log_items`.
     * @param dietPlanRepository - Used to resolve the user's active plan a
     *   new log attaches to — never taken from the request body, so a client
     *   can't log against another user's plan.
     * @param pool - The connection pool, used to run `createLog` in a
     *   transaction (log + items must be inserted atomically).
     */
    public constructor(
        repository: MealLogRepository,
        dietPlanRepository: DietPlanRepository,
        pool: DatabaseConnectionPool,
    ) {
        this.#repository = repository;
        this.#dietPlanRepository = dietPlanRepository;
        this.#pool = pool;
    }

    /**
     * Validates `fields`, resolves the user's active diet plan, and creates
     * the log with its items in one transaction. Totals are computed from
     * the items server-side (see {@link MealLogRepository.create}).
     *
     * @param userId - The logging user's id.
     * @param fields - The request body fields.
     * @returns The newly created log, with its items.
     * @throws {BadRequestError} If `fields` fails validation.
     * @throws {ConflictError} If the user has no active diet plan to log against.
     */
    public async createLog(userId: string, fields: CreateMealLogFields): Promise<MealLog> {
        const source = parseSource(fields.source);
        const items = parseItems(fields.items);
        const loggedAt = parseOptionalDate(fields.loggedAt) ?? new Date();

        const activePlan = await this.#dietPlanRepository.findActiveByUser(userId);
        if (!activePlan) {
            throw new ConflictError('You need an active diet plan before logging a meal.');
        }

        return this.#pool.transaction(async (client) => {
            const transactionalRepository = new MealLogRepository(client);
            return transactionalRepository.create({
                userId,
                dietPlanId: activePlan.id,
                source,
                loggedAt,
                userCorrected: fields.userCorrected ?? false,
                items,
            });
        });
    }

    /**
     * @param userId - The owning user's id.
     * @returns Every log the user has, most recently logged first.
     */
    public async listLogs(userId: string): Promise<MealLog[]> {
        return this.#repository.listByUser(userId);
    }

    /**
     * @param logId - The log to fetch.
     * @param requester - The authenticated caller (id + role).
     * @returns The log, with its items.
     * @throws {NotFoundError} If no such log exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     */
    public async getLog(logId: string, requester: { id: string; role: string }): Promise<MealLog> {
        return this.#requireOwnedLog(logId, requester);
    }

    /**
     * Applies a partial update (UC-22): replacing the item list recomputes
     * totals; `loggedAt`/`userCorrected` change independently.
     *
     * @param logId - The log to update.
     * @param requester - The authenticated caller (id + role).
     * @param fields - The fields to change.
     * @returns The updated log, with its items.
     * @throws {NotFoundError} If no such log exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     * @throws {BadRequestError} If any provided field fails validation.
     */
    public async updateLog(
        logId: string,
        requester: { id: string; role: string },
        fields: UpdateMealLogFields,
    ): Promise<MealLog> {
        await this.#requireOwnedLog(logId, requester);

        const update: UpdateMealLogInput = {};
        const loggedAt = parseOptionalDate(fields.loggedAt);
        if (loggedAt !== undefined) update.loggedAt = loggedAt;
        if (fields.userCorrected !== undefined) update.userCorrected = fields.userCorrected;
        if (fields.items !== undefined) update.items = parseItems(fields.items);

        // Replacing the item list is a delete-then-insert (see
        // MealLogRepository.update) — it must run in a transaction so a
        // request never leaves a log with zero items visible mid-update.
        const updated = await this.#pool.transaction(async (client) => {
            const transactionalRepository = new MealLogRepository(client);
            return transactionalRepository.update(logId, update);
        });
        if (!updated) {
            throw new NotFoundError('Meal log not found.');
        }
        return updated;
    }

    /**
     * Deletes a log and its items (UC-22 step 2).
     *
     * @param logId - The log to delete.
     * @param requester - The authenticated caller (id + role).
     * @throws {NotFoundError} If no such log exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     */
    public async deleteLog(logId: string, requester: { id: string; role: string }): Promise<void> {
        await this.#requireOwnedLog(logId, requester);
        const deleted = await this.#repository.delete(logId);
        if (!deleted) {
            throw new NotFoundError('Meal log not found.');
        }
    }

    /**
     * @param logId - The log to look up.
     * @param requester - The authenticated caller (id + role).
     * @returns The log, once ownership is confirmed.
     * @throws {NotFoundError} If no such log exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     */
    async #requireOwnedLog(logId: string, requester: { id: string; role: string }): Promise<MealLog> {
        const log = await this.#repository.findById(logId);
        if (!log) {
            throw new NotFoundError('Meal log not found.');
        }
        if (log.userId !== requester.id && requester.role !== 'admin') {
            throw new ForbiddenError('You do not have permission to access this meal log.');
        }
        return log;
    }
}
