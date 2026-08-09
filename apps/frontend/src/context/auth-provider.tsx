import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '@/context/auth-context'
import { api, getToken, setToken } from '@/lib/api-client'
import type { PublicUser } from '@/types/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false)
      return
    }
    api
      .get<PublicUser>('/users/me')
      .then(setUser)
      .catch(() => {
        setToken(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: PublicUser }>('/auth/login', {
      email,
      password,
    })
    setToken(result.token)
    setUser(result.user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await api.post<PublicUser>('/users', { email, password, displayName })
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
