import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DrinkDay } from '@/types/api'

// "Today" is the viewer's local day: the client picks the range, the server sums it, so every
// device shows the same totals for the same day.
function todayRange(): { from: string; to: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

export function useTodaysDrinks() {
  const { from } = todayRange()
  return useQuery({
    // The day is in the key so a tab left open past midnight starts a fresh query.
    queryKey: ['drink-logs', from],
    queryFn: () => {
      const range = todayRange()
      return api.get<DrinkDay>('/drink-logs', range)
    },
  })
}

export function useLogDrink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { drinkType: string; volumeMl: number }) => api.post('/drink-logs', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drink-logs'] })
    },
  })
}

export function useDeleteDrink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/drink-logs/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drink-logs'] })
    },
  })
}
