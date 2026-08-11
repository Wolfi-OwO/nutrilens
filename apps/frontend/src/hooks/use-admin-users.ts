import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { PublicUser, UserListResult, UserRole } from '@/types/api'

export interface AdminUsersFilters {
  q?: string
  role?: UserRole
  status?: PublicUser['status']
  page: number
  pageSize: number
}

export function useAdminUsers(filters: AdminUsersFilters) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () =>
      api.get<UserListResult>('/users', {
        q: filters.q,
        role: filters.role,
        status: filters.status,
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      }),
    placeholderData: (previous) => previous,
  })
}

export interface ChangeUserRoleStatusInput {
  id: string
  role?: UserRole
  status?: 'active' | 'suspended'
}

export function useChangeUserRoleStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ChangeUserRoleStatusInput) => api.patch<PublicUser>(`/users/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-log'] })
    },
  })
}
