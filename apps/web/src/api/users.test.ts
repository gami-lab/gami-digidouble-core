import { describe, expect, it, vi } from 'vitest'
import type { UserSummary } from '@gami/shared'
import { webRequest } from './client'
import { upsertUserPersona } from './users'

vi.mock('./client', () => ({
  webRequest: vi.fn(),
}))

describe('user persona api', () => {
  it('upserts persona via canonical users endpoint', async () => {
    const user: UserSummary = {
      userId: 'player.nora',
      persona: { name: 'Nora' },
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }
    vi.mocked(webRequest).mockResolvedValue({ user })

    const result = await upsertUserPersona('player.nora', { name: 'Nora' })

    expect(webRequest).toHaveBeenCalledWith('PUT', '/v1/users/player.nora/persona', {
      name: 'Nora',
    })
    expect(result).toEqual(user)
  })

  it('encodes userId safely for path params', async () => {
    const user: UserSummary = {
      userId: 'player nora',
      persona: {},
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }
    vi.mocked(webRequest).mockResolvedValue({ user })

    await upsertUserPersona('player nora', {})

    expect(webRequest).toHaveBeenCalledWith('PUT', '/v1/users/player%20nora/persona', {})
  })
})
