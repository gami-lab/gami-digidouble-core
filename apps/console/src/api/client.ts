import {
  ApiClientError as ApiError,
  createApiError,
  isApiResponseEnvelope,
  normalizeApiPath,
  normalizeApiUrl,
  shouldInjectApiKey,
} from '@gami/shared'
import { apiKey, apiUrl } from '../env'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export { ApiError }

export async function coreRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const normalizedPath = normalizeApiPath(path)
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

  // Check error field first: a conformant server always sets error when status is non-2xx,
  // so the envelope error field is the authoritative signal. The response.ok guard below
  // is a final safety net for any unexpected status/envelope combination.
  if (payload.error !== null) {
    throw createApiError(payload.error)
  }

  if (!response.ok) {
    throw new ApiError('NETWORK_ERROR', `Request failed with status ${String(response.status)}`)
  }

  if (payload.data === null) {
    throw new ApiError('NETWORK_ERROR', `Missing response data for ${normalizedPath}`)
  }

  return payload.data
}
