import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/use-auth'

// #105 — mounted inside ProtectedRoute, so `user` is already guaranteed
// non-null here; this only adds the role check. `user` comes from
// AuthProvider's /users/me fetch (auth-provider.tsx), not a client-side
// flag decoded out of the JWT — so this is checking the server's own
// answer to "who is this," not trusting anything the client could forge.
export function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}
