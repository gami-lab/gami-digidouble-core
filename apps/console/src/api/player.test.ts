import { afterEach, describe, expect, it, vi } from 'vitest'
import { coreRequest } from './client'
import { playerTokenFor, sessionPlayerRequest } from './player'

vi.mock('./client', () => ({ coreRequest: vi.fn() }))

const inOneHour = (): string => new Date(Date.now() + 3_600_000).toISOString()

afterEach(() => {
  vi.mocked(coreRequest).mockReset()
})

describe('console player credentials', () => {
  it('asks Core for an operator-issued token once per player', async () => {
    vi.mocked(coreRequest).mockResolvedValue({
      userId: 'user_cached',
      token: 'token_cached',
      expiresAt: inOneHour(),
    })

    await playerTokenFor('user_cached')
    const token = await playerTokenFor('user_cached')

    expect(token).toBe('token_cached')
    expect(coreRequest).toHaveBeenCalledTimes(1)
    expect(coreRequest).toHaveBeenCalledWith('POST', '/v1/admin/player-tokens', {
      userId: 'user_cached',
    })
  })

  it("calls a session's player route as that session's owner", async () => {
    vi.mocked(coreRequest)
      .mockResolvedValueOnce({ inspect: { session: { userId: 'user_owner' } } })
      .mockResolvedValueOnce({ userId: 'user_owner', token: 'owner_token', expiresAt: inOneHour() })
      .mockResolvedValueOnce({ ok: true })

    await sessionPlayerRequest('session_1', 'GET', '/v1/sessions/session_1/conversations')

    expect(coreRequest).toHaveBeenNthCalledWith(1, 'GET', '/v1/admin/sessions/session_1/inspect')
    expect(coreRequest).toHaveBeenLastCalledWith(
      'GET',
      '/v1/sessions/session_1/conversations',
      undefined,
      'owner_token',
    )
  })
})
