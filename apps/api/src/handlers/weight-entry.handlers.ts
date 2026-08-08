import type { Request, Response } from 'express';

import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import type {
    CreateWeightEntryInput,
    UpdateWeightEntryFields,
    WeightEntryService,
    WeightEntryTrendQuery,
} from '../services/weight-entry-service.ts';

function requireUser(req: Request): { id: string; role: string } {
    if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
    }
    return { id: req.user.sub, role: req.user.role };
}

/**
 * The `POST /weight-entries` handler. Must be mounted behind `requireAuth`.
 *
 * @param service - The service used to validate and create the entry.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function createWeightEntryHandler(service: WeightEntryService) {
    return async function createWeightEntry(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;
        const { weightKg, recordedAt, overwrite } = body;

        if (typeof weightKg !== 'number') {
            throw new BadRequestError('weightKg must be a number.');
        }

        const input: CreateWeightEntryInput = { weightKg };
        if (recordedAt !== undefined) {
            if (typeof recordedAt !== 'string') {
                throw new BadRequestError('recordedAt must be a string date.');
            }
            input.recordedAt = recordedAt;
        }
        if (overwrite !== undefined) {
            if (typeof overwrite !== 'boolean') {
                throw new BadRequestError('overwrite must be a boolean.');
            }
            input.overwrite = overwrite;
        }

        const entry = await service.createEntry(user.id, input);
        res.status(201).json(entry);
    };
}

/**
 * The `GET /weight-entries` handler — the caller's own entries, optionally
 * filtered by `from`/`to` (UC-40's trend chart). Must be mounted behind
 * `requireAuth`.
 *
 * @param service - The service used to list entries.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listWeightEntriesHandler(service: WeightEntryService) {
    return async function listWeightEntries(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const { from, to } = req.query;

        if (from !== undefined && typeof from !== 'string') {
            throw new BadRequestError('from must be a single date string.');
        }
        if (to !== undefined && typeof to !== 'string') {
            throw new BadRequestError('to must be a single date string.');
        }

        const query: WeightEntryTrendQuery = {};
        if (from !== undefined) query.from = from;
        if (to !== undefined) query.to = to;

        const entries = await service.listEntries(user.id, query);
        res.status(200).json(entries);
    };
}

/**
 * The `GET /weight-entries/:id` handler. Must be mounted behind `requireAuth`;
 * ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to fetch the entry.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getWeightEntryHandler(service: WeightEntryService) {
    return async function getWeightEntry(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const entry = await service.getEntry(req.params.id as string, user);
        res.status(200).json(entry);
    };
}

/**
 * The `PATCH /weight-entries/:id` handler. Must be mounted behind
 * `requireAuth`; ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to validate and apply the update.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function updateWeightEntryHandler(service: WeightEntryService) {
    return async function updateWeightEntry(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;

        const fields: UpdateWeightEntryFields = {};
        if ('weightKg' in body) {
            if (typeof body.weightKg !== 'number') {
                throw new BadRequestError('weightKg must be a number.');
            }
            fields.weightKg = body.weightKg;
        }
        if ('recordedAt' in body) {
            if (typeof body.recordedAt !== 'string') {
                throw new BadRequestError('recordedAt must be a string date.');
            }
            fields.recordedAt = body.recordedAt;
        }

        const entry = await service.updateEntry(req.params.id as string, user, fields);
        res.status(200).json(entry);
    };
}

/**
 * The `DELETE /weight-entries/:id` handler. Must be mounted behind
 * `requireAuth`; ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to delete the entry.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function deleteWeightEntryHandler(service: WeightEntryService) {
    return async function deleteWeightEntry(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        await service.deleteEntry(req.params.id as string, user);
        res.status(204).send();
    };
}
