import {
  ApiClientError as ApiError,
  createApiError,
  isApiErrorPayload,
  isApiResponseEnvelope,
  normalizeApiPath,
  normalizeApiUrl,
} from '@gami/shared'
import { apiUrl } from '../env'
import { playerFetch } from './player-session'

type HttpMethod = 'GET' | 'POST' | 'PUT'
export { ApiError }

export async function webRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const normalizedPath = normalizeApiPath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  const headers: Record<string, string> =
    body !== undefined ? { 'Content-Type': 'application/json' } : {}

  let response: Response
  try {
    response = await playerFetch(url, {
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
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
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
  const normalizedPath = normalizeApiPath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  let response: Response
  try {
    response = await playerFetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/*',
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
      return createApiError(payload.error)
    }
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      isApiErrorPayload(payload.error)
    ) {
      return createApiError(payload.error)
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }

  return new ApiError(
    'NETWORK_ERROR',
    `Request failed with status ${String(response.status)}: ${path}`,
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
