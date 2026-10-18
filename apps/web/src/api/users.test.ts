import { describe, expect, it, vi } from 'vitest'
import type { UserSummary } from '@gami/shared'
import { webRequest } from './client'
import { upsertUserPersona } from './users'

vi.mock('./client', () => ({
  webRequest: vi.fn(),
}))

describe('user persona api', () => {
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
})
