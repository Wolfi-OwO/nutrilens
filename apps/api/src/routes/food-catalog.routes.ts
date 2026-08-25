import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { getFoodCatalogByBarcodeHandler, searchFoodCatalogHandler } from '../handlers/food-catalog.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth } from '../middlewares/auth.ts';
import { validateQuery } from '../middlewares/validate.ts';
import { FoodCatalogRepository } from '../repository/food-catalog.repository.ts';
import { barcodeFoodCatalogQuerySchema, searchFoodCatalogQuerySchema } from '../schemas/food-catalog.schemas.ts';

const foodCatalogRepository = new FoodCatalogRepository(getPool());

/** The `/food-catalog` endpoints. */
export const foodCatalogRouter = Router();

foodCatalogRouter.get(
    '/food-catalog/search',
    requireAuth,
    validateQuery(searchFoodCatalogQuerySchema),
    asyncHandler(searchFoodCatalogHandler(foodCatalogRepository)),
);

foodCatalogRouter.get(
    '/food-catalog/barcode',
    requireAuth,
    validateQuery(barcodeFoodCatalogQuerySchema),
    asyncHandler(getFoodCatalogByBarcodeHandler(foodCatalogRepository)),
);
