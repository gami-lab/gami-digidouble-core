import type { ApiError as ApiErrorPayload, ApiResponse } from './api-response.js'

export function normalizeApiUrl(value: string): string {
  return value.replace(/\/$/, '')
}

export function normalizeApiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

export function shouldInjectApiKey(path: string): boolean {
  return normalizeApiPath(path) !== '/health'
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate['code'] === 'string' && typeof candidate['message'] === 'string'
}

export function isApiResponseEnvelope<T>(value: unknown): value is ApiResponse<T> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (!('data' in candidate) || !('error' in candidate)) return false

  if (candidate['error'] === null) return candidate['data'] !== null
  return isApiErrorPayload(candidate['error']) && candidate['data'] === null
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function createApiError(error: ApiErrorPayload): ApiError {
  return new ApiError(error.code, error.message, error.details)
}
