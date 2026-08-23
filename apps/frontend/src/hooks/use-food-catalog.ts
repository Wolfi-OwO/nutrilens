import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface FoodCatalogEntry {
    fdcId: number;
    description: string;
    category: string | null;
    caloriesKcal: number | null;
    proteinGrams: number | null;
    carbGrams: number | null;
    fatGrams: number | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * Hook to search the food catalog. Accepts a query string and returns
 * matching foods (per 100g nutrition data) ranked by relevance.
 *
 * @param query - The search query (min 2 chars, max 100).
 * @param limit - Max results to return (1-25, default 10).
 * @param enabled - Whether the query should run (default true).
 * @returns Query result with status and data.
 */
export function useFoodCatalog(query: string, limit: number = 10, enabled: boolean = true) {
    return useQuery<FoodCatalogEntry[]>({
        queryKey: ['food-catalog', query, limit],
        queryFn: async ({ signal }) => {
            return api.get<FoodCatalogEntry[]>('/food-catalog/search', {
                q: query,
                limit: String(limit),
            }, signal);
        },
        enabled: enabled && query.length >= 2 && query.length <= 100,
    });
}
