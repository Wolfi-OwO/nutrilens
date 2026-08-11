import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { AuditLogResult } from '@/types/api'

export function useAdminAuditLog(page: number, pageSize: number) {
  return useQuery({
    queryKey: ['admin', 'audit-log', page, pageSize],
    queryFn: () => api.get<AuditLogResult>('/admin/audit-log', { page: String(page), pageSize: String(pageSize) }),
    placeholderData: (previous) => previous,
  })
}
