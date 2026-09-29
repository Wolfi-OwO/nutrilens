import type { Request, Response } from 'express';

import { NotFoundError } from '../lib/errors.ts';
import { foodCatalogBarcodeLinks, listPayload, withLinks } from '../lib/hateoas.ts';
import type { FoodCatalogRepository } from '../repository/food-catalog.repository.ts';

/**
 * The `GET /food-catalog/search` handler. Returns foods matching the query,
 * ranked by relevance. Must be mounted behind `requireAuth`.
 *
 * @param repository - The repository used to search the catalog.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function searchFoodCatalogHandler(repository: FoodCatalogRepository) {
    return async function searchFoodCatalog(req: Request, res: Response): Promise<void> {
        const query = req.query as Record<string, string | undefined>;
        const q = query.q || '';
        const limit = parseInt(query.limit || '10', 10);
        const results = await repository.search(q, limit);
        res.status(200).json(listPayload(req, results));
    };
}

/**
 * The `GET /food-catalog/barcode` handler. Looks up a single food by its
 * EAN/UPC barcode. Must be mounted behind `requireAuth`.
 *
 * @param repository - The repository used to look up the catalog.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getFoodCatalogByBarcodeHandler(repository: FoodCatalogRepository) {
    return async function getFoodCatalogByBarcode(req: Request, res: Response): Promise<void> {
        const { code } = req.query as { code: string };
        const result = await repository.findByBarcode(code);
        // Was `res.status(200).json(result ?? null)` — a miss came back as a
        // 200 with a JSON `null` body, indistinguishable from "the barcode
        // field really is null" to a client that only checks the status
        // code. A miss is the absence of the resource GET /food-catalog/barcode
        // names, which is a 404 everywhere else in this API.
        if (!result) {
            throw new NotFoundError('No food catalog entry for that barcode.');
        }
        res.status(200).json(withLinks(result, foodCatalogBarcodeLinks(code)));
    };
}
