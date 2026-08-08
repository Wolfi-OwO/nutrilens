import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    createWeightEntryHandler,
    deleteWeightEntryHandler,
    getWeightEntryHandler,
    listWeightEntriesHandler,
    updateWeightEntryHandler,
} from '../handlers/weight-entry.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateBody, validateQuery } from '../middlewares/validate.ts';
import { WeightEntryRepository } from '../repository/weight-entry.repository.ts';
import {
    createWeightEntryBodySchema,
    listWeightEntriesQuerySchema,
    updateWeightEntryBodySchema,
} from '../schemas/weight-entry.schemas.ts';
import { WeightEntryService } from '../services/weight-entry-service.ts';

const weightEntryRepository = new WeightEntryRepository(getPool());
const weightEntryService = new WeightEntryService(weightEntryRepository);

/** The `/weight-entries` endpoints. */
export const weightEntriesRouter = Router();

weightEntriesRouter.post(
    '/weight-entries',
    requireAuth,
    validateBody(createWeightEntryBodySchema),
    asyncHandler(createWeightEntryHandler(weightEntryService)),
);
weightEntriesRouter.get(
    '/weight-entries',
    requireAuth,
    validateQuery(listWeightEntriesQuerySchema),
    asyncHandler(listWeightEntriesHandler(weightEntryService)),
);
weightEntriesRouter.get(
    '/weight-entries/:id',
    requireAuth,
    asyncHandler(getWeightEntryHandler(weightEntryService)),
);
weightEntriesRouter.patch(
    '/weight-entries/:id',
    requireAuth,
    validateBody(updateWeightEntryBodySchema),
    asyncHandler(updateWeightEntryHandler(weightEntryService)),
);
weightEntriesRouter.delete(
    '/weight-entries/:id',
    requireAuth,
    asyncHandler(deleteWeightEntryHandler(weightEntryService)),
);
