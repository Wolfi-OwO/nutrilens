import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ListResponse, MealLog, MealLogSource } from '@/types/api'

export function useMealLogs() {
  return useQuery({
    queryKey: ['meal-logs'],
    queryFn: async () => (await api.get<ListResponse<MealLog>>('/meal-logs')).items,
  })
}

export interface CreateMealLogItemInput {
  foodName: string
  portionGrams: number
  calories: number
  confidence?: number
  proteinGrams?: number
  carbGrams?: number
  fatGrams?: number
}

export interface CreateMealLogInput {
  source: MealLogSource
  items: CreateMealLogItemInput[]
}

export function useCreateMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMealLogInput) => api.post<MealLog>('/meal-logs', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meal-logs'] })
    },
  })
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/meal-logs/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meal-logs'] })
    },
  })
}
