import { createContext } from 'react'
import type { PublicUser } from '@/types/api'

export interface AuthContextValue {
  user: PublicUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  setUser: (user: PublicUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
