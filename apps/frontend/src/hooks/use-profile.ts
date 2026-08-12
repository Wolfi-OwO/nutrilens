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
