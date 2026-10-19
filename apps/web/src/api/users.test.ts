import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSummary } from '@gami/shared'
import { webRequest } from './client'
import { updateUserPersonaField, upsertUserPersona } from './users'

vi.mock('./client', () => ({
  webRequest: vi.fn(),
}))

describe('user persona api', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("upserts the signed-in player's persona without naming a user", async () => {
    const user: UserSummary = {
      userId: 'user_core_issued',
      persona: { name: 'Nora' },
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }
    vi.mocked(webRequest).mockResolvedValue({ user })

    const result = await upsertUserPersona({ name: 'Nora' })

    expect(webRequest).toHaveBeenCalledWith('PUT', '/v1/me/persona', { name: 'Nora' })
    expect(result).toEqual(user)
  })

  it('sets one persona field and keeps the fields already stored', async () => {
    vi.mocked(webRequest)
      .mockResolvedValueOnce({ persona: { name: 'Nora', roleInWorld: 'guest' } })
      .mockResolvedValueOnce({ user: {} })

    await updateUserPersonaField('name', 'Inspector Vega')

    expect(webRequest).toHaveBeenNthCalledWith(1, 'GET', '/v1/me/persona')
    expect(webRequest).toHaveBeenNthCalledWith(2, 'PUT', '/v1/me/persona', {
      name: 'Inspector Vega',
      roleInWorld: 'guest',
    })
  })

  it('starts from an empty persona for a new player', async () => {
    vi.mocked(webRequest)
      .mockResolvedValueOnce({ persona: null })
      .mockResolvedValueOnce({ user: {} })

    await updateUserPersonaField('roleInWorld', 'detective')

    expect(webRequest).toHaveBeenLastCalledWith('PUT', '/v1/me/persona', {
      roleInWorld: 'detective',
    })
  })
})
