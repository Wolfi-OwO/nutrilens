import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AdminStats } from '@/types/api';

export function useAdminStats() {
    return useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => api.get<AdminStats>('/admin/stats'),
        // Aggregate platform stats, not per-user data — a minute of staleness
        // is invisible and it avoids refetching every time an admin revisits
        // the overview page.
        staleTime: 60_000,
    });
}
