import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    createDrinkLogHandler,
    deleteDrinkLogHandler,
    listDrinkLogsHandler,
    listDrinksHandler,
} from '../handlers/drink-log.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateBody, validateIdParam, validateQuery } from '../middlewares/validate.ts';
import { DrinkLogRepository } from '../repository/drink-log.repository.ts';
import { createDrinkLogBodySchema, listDrinkLogsQuerySchema } from '../schemas/drink-log.schemas.ts';
import { DrinkLogService } from '../services/drink-log-service.ts';

const drinkLogService = new DrinkLogService(new DrinkLogRepository(getPool()));

/** The `/drinks` and `/drink-logs` endpoints. */
export const drinkLogsRouter = Router();

drinkLogsRouter.get('/drinks', requireAuth, listDrinksHandler());
drinkLogsRouter.post(
    '/drink-logs',
    requireAuth,
    validateBody(createDrinkLogBodySchema),
    asyncHandler(createDrinkLogHandler(drinkLogService)),
);
drinkLogsRouter.get(
    '/drink-logs',
    requireAuth,
    validateQuery(listDrinkLogsQuerySchema),
    asyncHandler(listDrinkLogsHandler(drinkLogService)),
);
drinkLogsRouter.delete(
    '/drink-logs/:id',
    requireAuth,
    validateIdParam(),
    asyncHandler(deleteDrinkLogHandler(drinkLogService)),
);
