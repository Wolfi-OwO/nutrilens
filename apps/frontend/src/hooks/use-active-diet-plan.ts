import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api-client'
import type { DietPlan } from '@/types/api'

export function useActiveDietPlan() {
  return useQuery({
    queryKey: ['diet-plan', 'active'],
    queryFn: async () => {
      try {
        return await api.get<DietPlan>('/diet-plans/active')
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}
