import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { OAuthProviderName } from '@/types/api'

export function useOAuthProviders() {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: async () => {
      try {
        const result = await api.get<{ providers: OAuthProviderName[] }>('/auth/providers')
        return result.providers
      } catch {
        return []
      }
    },
    staleTime: Infinity,
  })
}
