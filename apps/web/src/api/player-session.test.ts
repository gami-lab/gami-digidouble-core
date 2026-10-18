// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PLAYER_CREDENTIAL_STORAGE_KEY,
  clearStoredPlayer,
  getPlayer,
  playerFetch,
  readStoredPlayer,
} from './player-session'

function playerResponse(userId: string, token: string, expiresAt: string): Response {
  return new Response(JSON.stringify({ data: { userId, token, expiresAt }, error: null }), {
    status: 200,
  })
}

const inOneHour = (): string => new Date(Date.now() + 3_600_000).toISOString()

beforeEach(() => {
  clearStoredPlayer()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('player session', () => {
  it('asks Core for a new player once and reuses the stored credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue(playerResponse('user_core', 'token_1', inOneHour()))
    vi.stubGlobal('fetch', fetchMock)

    const first = await getPlayer()
    const second = await getPlayer()

    expect(first.userId).toBe('user_core')
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/v1/auth/player')
    expect(init.headers).toEqual({})
    expect(readStoredPlayer()?.token).toBe('token_1')
  })

  it('refreshes a token close to expiry with the current token', async () => {
    localStorage.setItem(
      PLAYER_CREDENTIAL_STORAGE_KEY,
      JSON.stringify({
        userId: 'user_core',
        token: 'old_token',
        expiresAt: new Date(Date.now() + 10_000).toISOString(),
      }),
    )
    const fetchMock = vi.fn().mockResolvedValue(playerResponse('user_core', 'token_2', inOneHour()))
    vi.stubGlobal('fetch', fetchMock)

    const player = await getPlayer()

    expect(player.token).toBe('token_2')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toEqual({ authorization: 'Bearer old_token' })
  })

  it('starts a new player when Core refuses to refresh the old token', async () => {
    localStorage.setItem(
      PLAYER_CREDENTIAL_STORAGE_KEY,
      JSON.stringify({ userId: 'user_old', token: 'stale', expiresAt: new Date(0).toISOString() }),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(playerResponse('user_new', 'token_new', inOneHour()))
    vi.stubGlobal('fetch', fetchMock)

    expect((await getPlayer()).userId).toBe('user_new')
  })

  it('sends the bearer token and retries once after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(playerResponse('user_core', 'token_1', inOneHour()))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(playerResponse('user_core', 'token_2', inOneHour()))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await playerFetch('http://localhost:3000/v1/sessions', { method: 'GET' })

    expect(response.status).toBe(200)
    const calls = fetchMock.mock.calls as [string, RequestInit][]
    expect(calls[1]?.[1].headers).toEqual({ authorization: 'Bearer token_1' })
    expect(calls[3]?.[1].headers).toEqual({ authorization: 'Bearer token_2' })
  })
})
