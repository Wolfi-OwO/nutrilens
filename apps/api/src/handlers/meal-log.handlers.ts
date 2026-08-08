import type { Request, Response } from 'express';
import type { z } from 'zod';

import { UnauthorizedError } from '../lib/errors.ts';
import type { createMealLogBodySchema, updateMealLogBodySchema } from '../schemas/meal-log.schemas.ts';
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

/**
 * @param item - A validated item from the request body.
 * @returns The same item, built up field-by-field so an absent optional
 *   field is genuinely absent rather than `undefined` — required under
 *   `exactOptionalPropertyTypes` since zod's `.optional()` infers
 *   `T | undefined`, not "possibly-missing `T`".
 */
function toItemFields(item: z.infer<typeof createMealLogBodySchema>['items'][number]): MealLogItemFields {
    const fields: MealLogItemFields = {
        foodName: item.foodName,
        portionGrams: item.portionGrams,
        calories: item.calories,
    };
    if (item.confidence !== undefined) fields.confidence = item.confidence;
    if (item.proteinGrams !== undefined) fields.proteinGrams = item.proteinGrams;
    if (item.carbGrams !== undefined) fields.carbGrams = item.carbGrams;
    if (item.fatGrams !== undefined) fields.fatGrams = item.fatGrams;
    return fields;
}

/**
 * The `POST /meal-logs` handler. Must be mounted behind `requireAuth` and
 * `validateBody(createMealLogBodySchema)`.
 *
 * @param service - The service used to validate and create the log.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function createMealLogHandler(service: MealLogService) {
    return async function createMealLog(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as z.infer<typeof createMealLogBodySchema>;

        const fields: CreateMealLogFields = { source: body.source, items: body.items.map(toItemFields) };
        if (body.loggedAt !== undefined) fields.loggedAt = body.loggedAt;
        if (body.userCorrected !== undefined) fields.userCorrected = body.userCorrected;

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
        const body = req.body as z.infer<typeof updateMealLogBodySchema>;

        const fields: UpdateMealLogFields = {};
        if (body.loggedAt !== undefined) fields.loggedAt = body.loggedAt;
        if (body.userCorrected !== undefined) fields.userCorrected = body.userCorrected;
        if (body.items !== undefined) fields.items = body.items.map(toItemFields);

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
