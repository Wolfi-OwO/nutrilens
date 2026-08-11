import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { AdminStats } from '@/types/api'

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
  })
}
