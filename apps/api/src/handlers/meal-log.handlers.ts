import type { Request, Response } from 'express';

import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import type {
    CreateMealLogFields,
    MealLogItemFields,
    MealLogService,
    UpdateMealLogFields,
} from '../services/meal-log-service.ts';

function requireUser(req: Request): { id: string; role: string } {
    if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
    }
    return { id: req.user.sub, role: req.user.role };
}

function parseItemsBody(value: unknown): MealLogItemFields[] {
    if (!Array.isArray(value)) {
        throw new BadRequestError('items must be an array.');
    }
    return value as MealLogItemFields[];
}

/**
 * The `POST /meal-logs` handler. Must be mounted behind `requireAuth`.
 *
 * @param service - The service used to validate and create the log.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function createMealLogHandler(service: MealLogService) {
    return async function createMealLog(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;

        if (typeof body.source !== 'string') {
            throw new BadRequestError('source is required.');
        }

        const fields: CreateMealLogFields = { source: body.source, items: parseItemsBody(body.items) };
        if (typeof body.loggedAt === 'string') fields.loggedAt = body.loggedAt;
        if (typeof body.userCorrected === 'boolean') fields.userCorrected = body.userCorrected;

        const log = await service.createLog(user.id, fields);
        res.status(201).json(log);
    };
}

/**
 * The `GET /meal-logs` handler — the caller's own log history. Must be
 * mounted behind `requireAuth`.
 *
 * @param service - The service used to list logs.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listMealLogsHandler(service: MealLogService) {
    return async function listMealLogs(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const logs = await service.listLogs(user.id);
        res.status(200).json(logs);
    };
}

/**
 * The `GET /meal-logs/:id` handler. Must be mounted behind `requireAuth`;
 * ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to fetch the log.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getMealLogHandler(service: MealLogService) {
    return async function getMealLog(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const log = await service.getLog(req.params.id as string, user);
        res.status(200).json(log);
    };
}

/**
 * The `PATCH /meal-logs/:id` handler (UC-22). Must be mounted behind
 * `requireAuth`; ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to validate and apply the update.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function updateMealLogHandler(service: MealLogService) {
    return async function updateMealLog(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;

        if ('loggedAt' in body && typeof body.loggedAt !== 'string') {
            throw new BadRequestError('loggedAt must be a string date.');
        }
        if ('userCorrected' in body && typeof body.userCorrected !== 'boolean') {
            throw new BadRequestError('userCorrected must be a boolean.');
        }

        const fields: UpdateMealLogFields = {};
        if ('loggedAt' in body) fields.loggedAt = body.loggedAt as string;
        if ('userCorrected' in body) fields.userCorrected = body.userCorrected as boolean;
        if ('items' in body) fields.items = parseItemsBody(body.items);

        const log = await service.updateLog(req.params.id as string, user, fields);
        res.status(200).json(log);
    };
}

/**
 * The `DELETE /meal-logs/:id` handler (UC-22). Must be mounted behind
 * `requireAuth`; ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to delete the log.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function deleteMealLogHandler(service: MealLogService) {
    return async function deleteMealLog(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        await service.deleteLog(req.params.id as string, user);
        res.status(204).send();
    };
}
