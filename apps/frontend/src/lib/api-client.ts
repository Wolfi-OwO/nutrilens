import type { ApiErrorBody } from '@/types/api'

// Unset in production builds on purpose: apps/api now serves the built
// frontend itself (see apps/api/src/static-frontend.ts), so same-origin is
// the correct default — only local dev (a separate Vite server) needs the
// explicit override in .env.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin
const TOKEN_STORAGE_KEY = 'nutrilens.token'

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | undefined

  constructor(status: number, body: ApiErrorBody | undefined) {
    super(body?.message || `Request failed with status ${String(status)}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | undefined>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const url = new URL(path, API_BASE_URL)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) return undefined as T

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload: unknown = isJson ? await response.json() : undefined

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorBody | undefined)
  }
  return payload as T
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | undefined>) =>
    request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export async function uploadPhoto<T>(path: string, file: File): Promise<T> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(new URL(path, API_BASE_URL), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload: unknown = isJson ? await response.json() : undefined

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorBody | undefined)
  }
  return payload as T
}
