import {
  ApiClientError as ApiError,
  createApiError,
  isApiResponseEnvelope,
  normalizeApiPath,
  normalizeApiUrl,
} from '@gami/shared'
import { apiUrl } from '../env'

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

export async function adminRequest<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const normalizedPath = normalizeApiPath(path)
  const url = `${normalizeApiUrl(apiUrl)}${normalizedPath}`

  const headers: HeadersInit = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  }

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

  if (payload.error !== null) {
    if (response.status === 401) notifySignedOut()
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
