import { describe, expect, it } from 'vitest'
import type { AvailableAvatarSummary } from '@gami/shared'
import { filterAvatarsForScenario } from './sessions'

describe('avatar visibility filters', () => {
  it('returns avatars only for the selected scenario', () => {
    const avatars: AvailableAvatarSummary[] = [
      createAvatar('avatar_1', 'scenario_1'),
      createAvatar('avatar_2', 'scenario_2'),
      createAvatar('avatar_3', 'scenario_1'),
    ]

    expect(
      filterAvatarsForScenario(avatars, 'scenario_1').map((avatar) => avatar.avatarId),
    ).toEqual(['avatar_1', 'avatar_3'])
  })
})

function createAvatar(avatarId: string, scenarioId: string): AvailableAvatarSummary {
  return {
    avatarId,
    scenarioId,
    name: `Avatar ${avatarId}`,
    status: 'active',
    personaPrompt: 'Prompt',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}
