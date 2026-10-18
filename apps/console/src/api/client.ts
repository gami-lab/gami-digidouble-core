import {
  ApiClientError as ApiError,
  createApiError,
  isApiResponseEnvelope,
  normalizeApiPath,
  isAdminApiPath,
  normalizeApiUrl,
  shouldInjectApiKey,
} from '@gami/shared'
import { apiKey, apiUrl } from '../env'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export { ApiError }

const signedOutListeners = new Set<() => void>()

/** Runs `listener` whenever Core reports the admin session as missing or expired. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener)
  return () => {
    signedOutListeners.delete(listener)
  }
}

export function notifySignedOut(): void {
  for (const listener of signedOutListeners) listener()
}

function buildHeaders(path: string, hasBody: boolean): HeadersInit {
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(!isAdminApiPath(path) && shouldInjectApiKey(path) ? { 'x-api-key': apiKey } : {}),
  }
}

export async function coreRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const normalizedPath = normalizeApiPath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  const headers = buildHeaders(normalizedPath, body !== undefined)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
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
    if (response.status === 401 && isAdminApiPath(normalizedPath)) notifySignedOut()
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
