import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { GameMasterOutput } from './game-master.types.js'
import { normalizeGameMasterOutput } from './gm-output-normalization.js'

function makeAvatar(avatarId: string, status: AvatarConfig['status'] = 'active'): AvatarConfig {
  return {
    avatarId,
    scenarioId: 'scenario_1',
    name: avatarId === 'avatar_1' ? 'Ava' : 'Theo',
    status,
    personaPrompt: `You are ${avatarId}.`,
    config: {},
    createdAt: '2026-07-25T10:00:00.000Z',
    updatedAt: '2026-07-25T10:00:00.000Z',
  }
}

function makeOutput(routing?: GameMasterOutput['routing']): GameMasterOutput {
  return {
    dialogueControl: { mode: 'transition', askFollowUp: false },
    retrievalPlan: { required: false },
    ...(routing !== undefined ? { routing } : {}),
    progressionUpdate: { progression: 'none' },
  }
}

describe('normalizeGameMasterOutput', () => {
  it('falls an unknown routing target back to stay', () => {
    expect(
      normalizeGameMasterOutput(makeOutput({ action: 'switch', avatarId: 'missing_avatar' }), [
        makeAvatar('avatar_1'),
        makeAvatar('avatar_2'),
      ]).routing,
    ).toEqual({ action: 'stay' })
  })

  it('keeps switch targets active and leaves suggest non-switching', () => {
    expect(
      normalizeGameMasterOutput(makeOutput({ action: 'switch', avatarId: 'Theo' }), [
        makeAvatar('avatar_1'),
        makeAvatar('avatar_2'),
      ]).routing,
    ).toEqual({ action: 'switch', avatarId: 'avatar_2' })
    expect(
      normalizeGameMasterOutput(makeOutput({ action: 'suggest', avatarId: 'avatar_2' }), [
        makeAvatar('avatar_1'),
        makeAvatar('avatar_2'),
      ]).routing,
    ).toEqual({ action: 'suggest', avatarId: 'avatar_2' })
  })

  it('omits routing when the scenario has only one active Avatar', () => {
    const normalized = normalizeGameMasterOutput(
      makeOutput({ action: 'switch', avatarId: 'avatar_2' }),
      [makeAvatar('avatar_1'), makeAvatar('avatar_2', 'archived')],
    )

    expect(normalized).not.toHaveProperty('routing')
  })
})
