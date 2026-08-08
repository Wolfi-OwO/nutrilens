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
import { WeightEntryRepository } from '../repository/weight-entry.repository.ts';
import { WeightEntryService } from '../services/weight-entry-service.ts';

const weightEntryRepository = new WeightEntryRepository(getPool());
const weightEntryService = new WeightEntryService(weightEntryRepository);

/** The `/weight-entries` endpoints. */
export const weightEntriesRouter = Router();

weightEntriesRouter.post(
    '/weight-entries',
    requireAuth,
    asyncHandler(createWeightEntryHandler(weightEntryService)),
);
weightEntriesRouter.get(
    '/weight-entries',
    requireAuth,
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
    asyncHandler(updateWeightEntryHandler(weightEntryService)),
);
weightEntriesRouter.delete(
    '/weight-entries/:id',
    requireAuth,
    asyncHandler(deleteWeightEntryHandler(weightEntryService)),
);
