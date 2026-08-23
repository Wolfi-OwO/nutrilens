import { useMutation } from '@tanstack/react-query'
import { api, uploadPhoto } from '@/lib/api-client'
import type { PublicUser } from '@/types/api'

// user isn't TanStack-cached (it lives in AuthContext, see auth-context.ts),
// so these mutations hand the updated PublicUser back to the caller instead
// of invalidating a query — profile.tsx wires onSuccess: setUser itself.

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (displayName: string) => api.patch<PublicUser>('/users/me', { displayName }),
  })
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => uploadPhoto<PublicUser>('/users/me/avatar', file),
  })
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: () => api.delete<PublicUser>('/users/me/avatar'),
  })
}

// GDPR Art. 20 (data portability). The server sets Content-Disposition, but
// that header only drives a browser-native download for a real navigation,
// not a fetch() response — so this mutation fetches the JSON via the
// existing `api.get` (already carries the auth header) and triggers the
// download itself via an Object URL, same trick as any client-side export.
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const data = await api.get<unknown>('/users/me/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `nutrilens-data-export-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  })
}

// GDPR Art. 17 (erasure). `password` is sent whenever the field has a value;
// the API only requires it for password-based accounts and 401s with a
// specific message otherwise — see deleteAccountHandler in apps/api.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api.delete<void>('/users/me', { password: password || undefined }),
  })
}
