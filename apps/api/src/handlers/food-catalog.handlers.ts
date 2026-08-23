import type { Request, Response } from 'express';

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
        res.status(200).json(results);
    };
}
