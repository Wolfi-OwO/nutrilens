import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    archiveDietPlanHandler,
    createDietPlanHandler,
    getActiveDietPlanHandler,
    listDietPlansHandler,
    updateDietPlanHandler,
} from '../handlers/diet-plan.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateBody } from '../middlewares/validate.ts';
import { DietPlanRepository } from '../repository/diet-plan.repository.ts';
import { createDietPlanBodySchema, updateDietPlanBodySchema } from '../schemas/diet-plan.schemas.ts';
import { DietPlanService } from '../services/diet-plan-service.ts';

const pool = getPool();
const dietPlanRepository = new DietPlanRepository(pool);
const dietPlanService = new DietPlanService(dietPlanRepository, pool);

/** The `/diet-plans` endpoints. */
export const dietPlansRouter = Router();

dietPlansRouter.post(
    '/diet-plans',
    requireAuth,
    validateBody(createDietPlanBodySchema),
    asyncHandler(createDietPlanHandler(dietPlanService)),
);
dietPlansRouter.get(
    '/diet-plans/active',
    requireAuth,
    asyncHandler(getActiveDietPlanHandler(dietPlanService)),
);
dietPlansRouter.get('/diet-plans', requireAuth, asyncHandler(listDietPlansHandler(dietPlanService)));
dietPlansRouter.patch(
    '/diet-plans/:id',
    requireAuth,
    validateBody(updateDietPlanBodySchema),
    asyncHandler(updateDietPlanHandler(dietPlanService)),
);
dietPlansRouter.post(
    '/diet-plans/:id/archive',
    requireAuth,
    asyncHandler(archiveDietPlanHandler(dietPlanService)),
);
