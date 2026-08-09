import { Router } from 'express';
import multer from 'multer';

import { getPool } from '../database/connection.ts';
import {
    createMealLogHandler,
    deleteMealLogHandler,
    getMealLogHandler,
    listMealLogsHandler,
    predictMealPhotoHandler,
    updateMealLogHandler,
} from '../handlers/meal-log.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { getAiServerClient } from '../lib/ai-server-client.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateBody } from '../middlewares/validate.ts';
import { DietPlanRepository } from '../repository/diet-plan.repository.ts';
import { MealLogRepository } from '../repository/meal-log.repository.ts';
import { createMealLogBodySchema, updateMealLogBodySchema } from '../schemas/meal-log.schemas.ts';
import { MealLogService } from '../services/meal-log-service.ts';

const pool = getPool();
const mealLogRepository = new MealLogRepository(pool);
const dietPlanRepository = new DietPlanRepository(pool);
const mealLogService = new MealLogService(mealLogRepository, dietPlanRepository, pool);

// In-memory only — never spooled to disk — matching apps/ai-server's own
// no-persistence guarantee on the receiving end (ADR-0001).
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** The `/meal-logs` endpoints. */
export const mealLogsRouter = Router();

mealLogsRouter.post(
    '/meal-logs',
    requireAuth,
    validateBody(createMealLogBodySchema),
    asyncHandler(createMealLogHandler(mealLogService)),
);
mealLogsRouter.get('/meal-logs', requireAuth, asyncHandler(listMealLogsHandler(mealLogService)));
mealLogsRouter.get('/meal-logs/:id', requireAuth, asyncHandler(getMealLogHandler(mealLogService)));
mealLogsRouter.patch(
    '/meal-logs/:id',
    requireAuth,
    validateBody(updateMealLogBodySchema),
    asyncHandler(updateMealLogHandler(mealLogService)),
);
mealLogsRouter.delete(
    '/meal-logs/:id',
    requireAuth,
    asyncHandler(deleteMealLogHandler(mealLogService)),
);
mealLogsRouter.post(
    '/meal-logs/photo-prediction',
    requireAuth,
    photoUpload.single('file'),
    asyncHandler(predictMealPhotoHandler(getAiServerClient())),
);
