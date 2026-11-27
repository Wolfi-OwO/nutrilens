import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '@/context/auth-context'
import { api } from '@/lib/api-client'
import { signInWithPasskey } from '@/lib/passkeys'
import { derivePasswordProof, withPasswordProof } from '@/lib/password-proof'
import type { PublicUser } from '@/types/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // The HttpOnly cookie is invisible to script, so the only way to know whether
    // there is a session is to ask; a 401 just means signed out.
    api
      .get<PublicUser>('/users/me')
      .then(setUser)
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (email: string, password: string, code?: string) => {
    const result = await withPasswordProof(email, password, (fields) =>
      api.post<{ user: PublicUser }>('/auth/login', { email, ...fields, ...(code ? { code } : {}) }),
    )
    setUser(result.user)
  }, [])

  const loginWithPasskey = useCallback(async () => {
    setUser(await signInWithPasskey())
  }, [])

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await api.post<PublicUser>('/users', {
        email,
        password: await derivePasswordProof(email, password),
        displayName,
      })
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    setUser(null)
    // Only the server can clear an HttpOnly cookie; a failed call leaves the
    // cookie until it expires, but the UI is already signed out.
    void api.post('/auth/logout').catch(() => undefined)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithPasskey, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
