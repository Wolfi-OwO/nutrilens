import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { WeightEntry } from '@/types/api'

export function useWeightEntries() {
  return useQuery({
    queryKey: ['weight-entries'],
    queryFn: () => api.get<WeightEntry[]>('/weight-entries'),
  })
}

export interface CreateWeightEntryInput {
  weightKg: number
  recordedAt?: string
  // Replace a same-day weigh-in instead of returning 409 conflict;
  // a re-weigh-in must replace the day's entry, not coexist with it.
  overwrite?: boolean
}

export function useCreateWeightEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWeightEntryInput) => api.post<WeightEntry>('/weight-entries', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weight-entries'] })
    },
  })
}
