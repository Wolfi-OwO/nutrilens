import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DietPlan, DietPlanGoal } from '@/types/api'

export interface CreateDietPlanInput {
  dailyCalorieTarget: number
  proteinTargetGrams: number
  carbTargetGrams: number
  fatTargetGrams: number
  goal: DietPlanGoal
}

export function useCreateDietPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDietPlanInput) => api.post<DietPlan>('/diet-plans', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diet-plan'] })
    },
  })
}

export interface UpdateDietPlanInput {
  dailyCalorieTarget: number
  proteinTargetGrams: number
  carbTargetGrams: number
  fatTargetGrams: number
}

export function useUpdateDietPlan(planId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDietPlanInput) => api.patch<DietPlan>(`/diet-plans/${planId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diet-plan'] })
    },
  })
}
