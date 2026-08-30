import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import {
    listDiscounterCountriesHandler,
    listDiscountersHandler,
    listDiscounterStoresHandler,
    nearStoresHandler,
} from '../handlers/store-discovery.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateQuery } from '../middlewares/validate.ts';
import { DiscounterRepository } from '../repository/discounter.repository.ts';
import { StoreLocationRepository } from '../repository/store-location.repository.ts';
import {
    listDiscountersQuerySchema,
    listDiscounterStoresQuerySchema,
} from '../schemas/discounter.schemas.ts';
import { nearStoresQuerySchema } from '../schemas/store-location.schemas.ts';

const discounterRepository = new DiscounterRepository(getPool());
const storeLocationRepository = new StoreLocationRepository(getPool());

/**
 * The read-only `/discounters` and `/stores` endpoints (issues #191/#212).
 *
 * Nothing here writes. Store and discounter rows come from data imports
 * (scripts/import-geolocet-spar-data.mjs, scripts/import-osm-supermarkets.ts),
 * not from users, and the OSM half is ODbL — a write path would put
 * user-contributed rows into a set that has to stay separable by `source`.
 */
export const storeDiscoveryRouter = Router();

// Before '/discounters' below only for readability — Express matches on the
// full path, and '/discounters/countries' cannot collide with '/discounters'
// or with the three-segment '/discounters/:code/stores'.
storeDiscoveryRouter.get(
    '/discounters/countries',
    requireAuth,
    asyncHandler(listDiscounterCountriesHandler(discounterRepository)),
);

storeDiscoveryRouter.get(
    '/discounters',
    requireAuth,
    validateQuery(listDiscountersQuerySchema),
    asyncHandler(listDiscountersHandler(discounterRepository)),
);

storeDiscoveryRouter.get(
    '/discounters/:code/stores',
    requireAuth,
    validateQuery(listDiscounterStoresQuerySchema),
    asyncHandler(listDiscounterStoresHandler(discounterRepository, storeLocationRepository)),
);

storeDiscoveryRouter.get(
    '/stores/near',
    requireAuth,
    validateQuery(nearStoresQuerySchema),
    asyncHandler(nearStoresHandler(storeLocationRepository)),
);
