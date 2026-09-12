import type { ApiError as SharedApiError, ApiResponse } from '@gami/shared'
import { apiKey, apiUrl } from '../env'

type HttpMethod = 'GET' | 'POST' | 'PUT'
type ApiResponseEnvelope<T> = ApiResponse<T>
type ApiResponseError = SharedApiError

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, '')
const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`)
const shouldInjectApiKey = (path: string): boolean => normalizePath(path) !== '/health'

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isApiResponseError = (value: unknown): value is ApiResponseError => {
  if (!isObjectRecord(value)) {
    return false
  }
  return typeof value.code === 'string' && typeof value.message === 'string'
}

const isApiResponseEnvelope = <T>(value: unknown): value is ApiResponseEnvelope<T> => {
  if (!isObjectRecord(value)) {
    return false
  }

  if (!('data' in value) || !('error' in value)) {
    return false
  }

  if (value.error === null) {
    return value.data !== null
  }

  return isApiResponseError(value.error) && value.data === null
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

export async function webRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const normalizedPath = normalizePath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(shouldInjectApiKey(normalizedPath) ? { 'x-api-key': apiKey } : {}),
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', `Network request failed: ${method} ${normalizedPath}`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('NETWORK_ERROR', `Invalid JSON response from ${normalizedPath}`)
  }

  if (!isApiResponseEnvelope<T>(payload)) {
    throw new ApiError('NETWORK_ERROR', `Invalid API response envelope from ${normalizedPath}`)
  }

  if (payload.error !== null) {
    throw new ApiError(payload.error.code, payload.error.message, payload.error.details)
  }

  if (!response.ok) {
    throw new ApiError('NETWORK_ERROR', `Request failed with status ${String(response.status)}`)
  }

  if (payload.data === null) {
    throw new ApiError('NETWORK_ERROR', `Missing response data for ${normalizedPath}`)
  }

  return payload.data
}

export async function webBinaryRequest(
  method: 'POST',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const normalizedPath = normalizePath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/*',
        ...(shouldInjectApiKey(normalizedPath) ? { 'x-api-key': apiKey } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal === undefined ? {} : { signal }),
    })
  } catch (error) {
    if (isAbortError(error) && signal?.aborted === true) {
      throw error
    }
    throw new ApiError('NETWORK_ERROR', `Network request failed: ${method} ${normalizedPath}`)
  }

  if (!response.ok) {
    throw await readApiError(response, normalizedPath)
  }

  return response
}

async function readApiError(response: Response, path: string): Promise<ApiError> {
  try {
    const payload: unknown = await response.json()
    if (isApiResponseEnvelope<null>(payload) && payload.error !== null) {
      return new ApiError(payload.error.code, payload.error.message, payload.error.details)
    }
  } catch {
    // Fall through to the status-based error below.
  }

  return new ApiError(
    'NETWORK_ERROR',
    `Request failed with status ${String(response.status)}: ${path}`,
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
