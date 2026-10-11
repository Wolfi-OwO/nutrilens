import type { ApiErrorBody } from '@/types/api'

// Unset in production builds on purpose: apps/api now serves the built
// frontend itself (see apps/api/src/static-frontend.ts), so same-origin is
// the correct default — only local dev (a separate Vite server) needs the
// explicit override in .env.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin

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

// The API only accepts a cookie-authenticated write that carries this header; a
// cross-site form or image request cannot add it (see requireAuth in the API).
const CSRF_HEADERS = { 'X-Requested-With': 'fetch' }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | undefined>
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    // The session is an HttpOnly cookie the browser attaches itself.
    credentials: 'include',
    headers: {
      ...CSRF_HEADERS,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
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
  get: <T>(path: string, query?: Record<string, string | undefined>, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}

export async function uploadPhoto<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(new URL(path, API_BASE_URL), {
    method: 'POST',
    credentials: 'include',
    headers: CSRF_HEADERS,
    body: form,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload: unknown = isJson ? await response.json() : undefined

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorBody | undefined)
  }
  return payload as T
}
