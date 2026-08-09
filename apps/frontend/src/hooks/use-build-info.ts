import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { BuildInfo } from '@/types/api'

// Mirrors the server's own default (config/index.ts's buildInfo) — shown
// when /version can't be reached (dev without the API, a brief outage),
// so the footer doesn't silently lose its version chip.
const FALLBACK_BUILD_INFO: BuildInfo = {
  version: 'dev',
  revision: '',
  buildDate: '',
  repositoryUrl: 'https://github.com/Wolfi-OwO/nutrilens',
}

export function useBuildInfo() {
  return useQuery({
    queryKey: ['build-info'],
    queryFn: async () => {
      try {
        return await api.get<BuildInfo>('/version')
      } catch {
        return FALLBACK_BUILD_INFO
      }
    },
    staleTime: Infinity,
  })
}
