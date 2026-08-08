import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.ts';
import type { WeightEntry } from '../models/weight-entry.model.ts';
import type { UpdateWeightEntryInput } from '../repository/weight-entry.repository.ts';
import type { WeightEntryRepository } from '../repository/weight-entry.repository.ts';

// Sane physiological bounds — the last line of defense against a client
// sending garbage, same reasoning as DietPlanService's target bounds.
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION
    );
}

function assertValidWeight(weightKg: number): void {
    if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
        throw new BadRequestError(`weightKg must be a number between ${String(MIN_WEIGHT_KG)} and ${String(MAX_WEIGHT_KG)}.`);
    }
}

function parseDate(field: string, value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError(`${field} must be a valid date.`);
    }
    return date;
}

export interface CreateWeightEntryInput {
    weightKg: number;
    /** ISO date/datetime string; defaults to now if omitted (UC-41 step 1). */
    recordedAt?: string;
    /** UC-41 alt-flow 1a: replace the day's existing entry instead of conflicting. */
    overwrite?: boolean;
}

export interface UpdateWeightEntryFields {
    weightKg?: number;
    recordedAt?: string;
}

export interface WeightEntryTrendQuery {
    from?: string;
    to?: string;
}

export class WeightEntryService {
    readonly #repository: WeightEntryRepository;

    /** @param repository - The data-access layer for the `weight_entries` table. */
    public constructor(repository: WeightEntryRepository) {
        this.#repository = repository;
    }

    /**
     * Records a weight entry for `userId` (UC-41).
     *
     * @param userId - The owning user's id.
     * @param input - The entry fields from the request body.
     * @returns The newly created (or, with `overwrite`, replaced) entry.
     * @throws {BadRequestError} If `weightKg` or `recordedAt` fail validation.
     * @throws {ConflictError} If an entry already exists for that user+day
     *   and `overwrite` wasn't set.
     */
    public async createEntry(userId: string, input: CreateWeightEntryInput): Promise<WeightEntry> {
        assertValidWeight(input.weightKg);
        const recordedAt = input.recordedAt === undefined ? new Date() : parseDate('recordedAt', input.recordedAt);

        try {
            return await this.#repository.create({
                userId,
                weightKg: input.weightKg,
                recordedAt,
                overwrite: input.overwrite ?? false,
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError(
                    'A weight entry already exists for that day. Pass overwrite: true to replace it.',
                );
            }
            throw error;
        }
    }

    /**
     * The trend query behind UC-40's chart (issue #23's "trend query
     * supports a date range" acceptance criterion).
     *
     * @param userId - The owning user's id.
     * @param query - The optional `from`/`to` date-range bounds.
     * @returns Matching entries, oldest first.
     * @throws {BadRequestError} If `from`/`to` fail validation, or `from` is after `to`.
     */
    public async listEntries(userId: string, query: WeightEntryTrendQuery): Promise<WeightEntry[]> {
        const from = query.from === undefined ? undefined : parseDate('from', query.from);
        const to = query.to === undefined ? undefined : parseDate('to', query.to);
        if (from !== undefined && to !== undefined && from > to) {
            throw new BadRequestError('from must not be after to.');
        }
        return this.#repository.listByUserInRange(userId, from, to);
    }

    /**
     * @param entryId - The entry to fetch.
     * @param requester - The authenticated caller (id + role).
     * @returns The entry, once ownership is confirmed.
     */
    public async getEntry(entryId: string, requester: { id: string; role: string }): Promise<WeightEntry> {
        return this.#requireOwnedEntry(entryId, requester);
    }

    /**
     * Applies a partial update to an entry, after checking `requester` is
     * either the entry's owner or an admin.
     *
     * @param entryId - The entry to update.
     * @param requester - The authenticated caller (id + role).
     * @param fields - The fields to change.
     * @returns The updated entry.
     * @throws {NotFoundError} If no such entry exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     * @throws {BadRequestError} If any provided field fails validation.
     * @throws {ConflictError} If moving `recordedAt` collides with another
     *   entry already on that day.
     */
    public async updateEntry(
        entryId: string,
        requester: { id: string; role: string },
        fields: UpdateWeightEntryFields,
    ): Promise<WeightEntry> {
        await this.#requireOwnedEntry(entryId, requester);

        const update: UpdateWeightEntryInput = {};
        if (fields.weightKg !== undefined) {
            assertValidWeight(fields.weightKg);
            update.weightKg = fields.weightKg;
        }
        if (fields.recordedAt !== undefined) {
            update.recordedAt = parseDate('recordedAt', fields.recordedAt);
        }

        try {
            const updated = await this.#repository.update(entryId, update);
            if (!updated) {
                throw new NotFoundError('Weight entry not found.');
            }
            return updated;
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError('A weight entry already exists for that day.');
            }
            throw error;
        }
    }

    /**
     * Deletes an entry, after checking `requester` is either the entry's
     * owner or an admin.
     *
     * @param entryId - The entry to delete.
     * @param requester - The authenticated caller (id + role).
     */
    public async deleteEntry(entryId: string, requester: { id: string; role: string }): Promise<void> {
        await this.#requireOwnedEntry(entryId, requester);
        await this.#repository.delete(entryId);
    }

    /**
     * @param entryId - The entry to look up.
     * @param requester - The authenticated caller (id + role).
     * @returns The entry, once ownership is confirmed.
     * @throws {NotFoundError} If no such entry exists.
     * @throws {ForbiddenError} If `requester` isn't the owner or an admin.
     */
    async #requireOwnedEntry(entryId: string, requester: { id: string; role: string }): Promise<WeightEntry> {
        const entry = await this.#repository.findById(entryId);
        if (!entry) {
            throw new NotFoundError('Weight entry not found.');
        }
        if (entry.userId !== requester.id && requester.role !== 'admin') {
            throw new ForbiddenError('You do not have permission to access this weight entry.');
        }
        return entry;
    }
}
