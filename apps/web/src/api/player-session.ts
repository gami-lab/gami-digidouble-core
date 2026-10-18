import {
  ApiClientError as ApiError,
  isApiResponseEnvelope,
  normalizeApiUrl,
  type PlayerTokenResponse,
} from '@gami/shared'
import { apiUrl } from '../env'
import { getDefaultStorage, type StorageLike } from '../storage'

export const PLAYER_CREDENTIAL_STORAGE_KEY = 'gami.web.player.v1'

/** Refresh slightly before expiry so an in-flight request never carries a just-expired token. */
const REFRESH_MARGIN_MS = 60_000

let pending: Promise<PlayerTokenResponse> | null = null

export function readStoredPlayer(
  storage: StorageLike = getDefaultStorage(),
): PlayerTokenResponse | null {
  const raw = storage.getItem(PLAYER_CREDENTIAL_STORAGE_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPlayerTokenResponse(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearStoredPlayer(storage: StorageLike = getDefaultStorage()): void {
  storage.removeItem(PLAYER_CREDENTIAL_STORAGE_KEY)
}

/**
 * Returns the Core-issued player credential, creating a player on first use and refreshing the
 * token before it expires. A token Core refuses to refresh is replaced by a new player.
 */
export async function getPlayer(
  options: { forceRefresh?: boolean } = {},
): Promise<PlayerTokenResponse> {
  const stored = readStoredPlayer()
  if (
    stored !== null &&
    options.forceRefresh !== true &&
    Date.parse(stored.expiresAt) - Date.now() > REFRESH_MARGIN_MS
  ) {
    return stored
  }
  pending ??= issuePlayer(stored?.token).finally(() => {
    pending = null
  })
  return pending
}

/** `fetch` with the player's bearer token; a 401 triggers one refresh and retry. */
export async function playerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = async (player: PlayerTokenResponse): Promise<Response> =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        authorization: `Bearer ${player.token}`,
      },
    })

  const response = await send(await getPlayer())
  if (response.status !== 401) return response
  return send(await getPlayer({ forceRefresh: true }))
}

async function issuePlayer(currentToken: string | undefined): Promise<PlayerTokenResponse> {
  let player = await requestPlayer(currentToken)
  if (player === null && currentToken !== undefined) player = await requestPlayer(undefined)
  if (player === null) throw new ApiError('UNAUTHORIZED', 'Could not obtain a player identity')
  getDefaultStorage().setItem(PLAYER_CREDENTIAL_STORAGE_KEY, JSON.stringify(player))
  return player
}

async function requestPlayer(token: string | undefined): Promise<PlayerTokenResponse | null> {
  let response: Response
  try {
    response = await fetch(`${normalizeApiUrl(apiUrl)}/v1/auth/player`, {
      method: 'POST',
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network request failed: POST /v1/auth/player')
  }
  if (response.status === 401) return null
  const payload: unknown = await response.json()
  if (!isApiResponseEnvelope<PlayerTokenResponse>(payload) || payload.data === null) {
    throw new ApiError('NETWORK_ERROR', 'Invalid player token response')
  }
  return payload.data
}

function isPlayerTokenResponse(value: unknown): value is PlayerTokenResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record['userId'] === 'string' &&
    typeof record['token'] === 'string' &&
    typeof record['expiresAt'] === 'string'
  )
}
