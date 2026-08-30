import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
    DiscounterListResponse,
    NearbyStoreListResponse,
    StoreListResponse,
} from '@/types/api';

// Reference data, not user data: discounters and store locations only change
// when an import script runs (scripts/import-osm-supermarkets.ts), which is a
// deploy-scale event, not a per-session one. The app-wide default staleTime is
// 30s (main.tsx), which would refetch the 31-chain list every time the picker
// is reopened — and apiRateLimiter caps the whole app at 300 req/15min per IP
// (apps/api/src/middlewares/rate-limit.ts). Ten minutes is far longer than any
// logging session and still short enough that an import lands the same day.
const REFERENCE_DATA_STALE_MS = 10 * 60 * 1000;

/** Every discounter in one country, with its store count. `AT` is the only country seeded today. */
export function useDiscounters(country: string, enabled = true) {
    return useQuery({
        queryKey: ['discounters', country],
        queryFn: ({ signal }) =>
            api.get<DiscounterListResponse>('/discounters', { country }, signal),
        staleTime: REFERENCE_DATA_STALE_MS,
        enabled,
    });
}

/**
 * One page of a single chain's stores. The API caps `limit` at 25, and Billa
 * alone has ~1,067 branches — so this is deliberately "the first page", and
 * any UI built on it has to say so rather than implying it lists them all.
 */
export function useDiscounterStores(code: string | null, enabled = true) {
    return useQuery({
        queryKey: ['discounter-stores', code],
        queryFn: ({ signal }) =>
            api.get<StoreListResponse>(
                `/discounters/${code ?? ''}/stores`,
                { limit: '25' },
                signal,
            ),
        staleTime: REFERENCE_DATA_STALE_MS,
        enabled: enabled && !!code,
    });
}

/**
 * Nearest stores of any chain to a point. The one query that can actually
 * answer "which branch was I in", since it needs no store-name search the API
 * does not have.
 *
 * @param coords - A browser geolocation fix, or null before the user grants one.
 */
export function useNearbyStores(coords: { lat: number; lon: number } | null) {
    return useQuery({
        queryKey: ['stores-near', coords?.lat, coords?.lon],
        queryFn: ({ signal }) =>
            api.get<NearbyStoreListResponse>(
                '/stores/near',
                {
                    lat: String(coords?.lat ?? 0),
                    lon: String(coords?.lon ?? 0),
                    radius_m: '5000',
                    limit: '25',
                },
                signal,
            ),
        // A coordinate pair is a one-off fix, not a stable key worth holding: a
        // second reading a few metres away is a different key anyway.
        staleTime: REFERENCE_DATA_STALE_MS,
        enabled: !!coords,
    });
}
