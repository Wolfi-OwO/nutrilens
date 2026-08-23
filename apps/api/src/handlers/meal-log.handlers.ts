import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import type { AiServerClient } from '../lib/ai-server-client.ts';
import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import { stripExif } from '../lib/strip-exif.ts';
import type { createMealLogBodySchema, updateMealLogBodySchema } from '../schemas/meal-log.schemas.ts';
import type {
    CreateMealLogFields,
    MealLogItemFields,
    MealLogService,
    UpdateMealLogFields,
} from '../services/meal-log-service.ts';

/** Nutrition data for a single Food-101 label (per 100g). */
export interface Food101NutritionEntry {
    label: string;
    calories: number | null;
    proteinGrams: number | null;
    carbGrams: number | null;
    fatGrams: number | null;
}

/** Per-100g nutrition macros for a food, returned by the prediction handler. */
export interface NutritionMacros {
    calories: number | null;
    proteinGrams: number | null;
    carbGrams: number | null;
    fatGrams: number | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const foodNutritionData = JSON.parse(readFileSync(join(__dirname, '../data/food101-nutrition.json'), 'utf8')) as Food101NutritionEntry[];

function requireUser(req: Request): { id: string; role: string } {
    if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
    }
    return { id: req.user.sub, role: req.user.role };
}

// Build a lookup map from Food-101 labels to per-100 g nutrition data.
// The nutrition JSON is indexed by label; this map enables O(1) lookup during
// prediction response assembly.
// ponytail: static initialization, no regeneration needed during runtime.
function buildNutritionLookup(): Map<string, NutritionMacros> {
    const lookup = new Map<string, NutritionMacros>();
    for (const entry of foodNutritionData) {
        lookup.set(entry.label, {
            calories: entry.calories,
            proteinGrams: entry.proteinGrams,
            carbGrams: entry.carbGrams,
            fatGrams: entry.fatGrams,
        });
    }
    return lookup;
}

const nutritionLookup = buildNutritionLookup();

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

/**
 * The `POST /meal-logs/photo-prediction` handler. Forwards an uploaded
 * photo to apps/ai-server and returns its prediction — does not create a
 * meal log itself (ADR-0001's narrow contract). The client reviews the
 * prediction and then calls `POST /meal-logs` with `source: 'ai_photo'` to
 * persist it, same as any other log.
 *
 * Must be mounted behind `requireAuth` and a multer `single('file')`
 * middleware. An AI-server failure is a normal 200 with `available: false`
 * (ADR-0003), never a thrown error — `client` is `undefined` when
 * `AI_SERVER_URL` isn't configured, treated the same way.
 */
export function predictMealPhotoHandler(client: AiServerClient | undefined) {
    return async function predictMealPhoto(req: Request, res: Response): Promise<void> {
        requireUser(req);

        if (!req.file) {
            throw new BadRequestError('No photo uploaded — expected a multipart "file" field.');
        }
        if (!client) {
            res.status(200).json({ available: false, reason: 'not_configured' });
            return;
        }

        const photoBytes = await stripExif(req.file.buffer);
        // req.id is always a string here — genReqId (app.ts) only ever
        // returns one (see lib/logger.ts's correlationId) — but pino-http's
        // own ReqId type is `string | number | object`, hence the assertion.
        const outcome = await client.predict(photoBytes, req.file.originalname, req.file.mimetype, req.id as string);

        if (outcome.status === 'invalid_image') {
            throw new BadRequestError(outcome.message);
        }
        if (outcome.status === 'unavailable') {
            res.status(200).json({ available: false, reason: outcome.reason });
            return;
        }

        // Attach per-100 g macros to each prediction from the offline lookup table.
        // A prediction without an entry in the lookup (missing or unmapped label)
        // still returns as-is with macros omitted — never invent zeros or drop predictions.
        const predictionsWithMacros = outcome.result.predictions.map((pred: { label: string; confidence: number }) => {
            const macros = nutritionLookup.get(pred.label);
            const withMacros: { label: string; confidence: number; macros?: NutritionMacros } = {
                label: pred.label,
                confidence: pred.confidence,
            };
            if (macros) {
                withMacros.macros = macros;
            }
            return withMacros;
        });

        res.status(200).json({
            available: true,
            predictions: predictionsWithMacros,
            isConfident: outcome.result.isConfident,
        });
    };
}
