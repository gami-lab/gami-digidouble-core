import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from '../../../domain/avatar/avatar.fixtures.js'
import { buildAvatarAwareness } from '../../../domain/avatar/avatar-awareness.service.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { GetAvailableAvatarsUseCase } from '../get-available-avatars/get-available-avatars.use-case.js'
import { StartSessionUseCase } from './start-session.use-case.js'

const guide = makeAvatarConfig({
  avatarId: 'avatar_guide',
  scenarioId: 'scenario_1',
  name: 'Guide',
})
const witness = makeAvatarConfig({
  avatarId: 'avatar_witness',
  scenarioId: 'scenario_1',
  name: 'Witness',
})
const retired = makeAvatarConfig({
  avatarId: 'avatar_retired',
  scenarioId: 'scenario_1',
  name: 'Retired',
  status: 'archived',
})

function makeScenario(avatarAvailability: Scenario['avatarAvailability']): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability,
    config: {},
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
  }
}

async function startSession(avatarAvailability: Scenario['avatarAvailability']) {
  const sessions = new InMemorySessionRepository()
  const avatars = new InMemoryAvatarRepository([guide, witness, retired])
  const { session } = await new StartSessionUseCase(
    sessions,
    new InMemoryScenarioRepository([makeScenario(avatarAvailability)]),
    avatars,
  ).execute({ userId: 'user_1', scenarioId: 'scenario_1' })
  const available = await new GetAvailableAvatarsUseCase(sessions, avatars).execute({
    sessionId: session.sessionId,
  })
  return { session, sessions, avatars, available }
}

describe('session unlock state', () => {
  it('persists every active Avatar as unlocked when the scenario has no availability policy', async () => {
    const { session, sessions, available } = await startSession({ initialAvatarIds: [] })

    expect(session.unlockedAvatarIds).toEqual(['avatar_guide', 'avatar_witness'])
    expect((await sessions.findById(session.sessionId))?.unlockedAvatarIds).toEqual([
      'avatar_guide',
      'avatar_witness',
    ])
    expect(available.avatars.map((avatar) => avatar.avatarId)).toEqual([
      'avatar_guide',
      'avatar_witness',
    ])
  })

  it('exposes only the initial Avatars when the scenario declares a policy', async () => {
    const { session, available } = await startSession({
      initialAvatarIds: ['avatar_guide'],
      unlockableAvatarIds: ['avatar_witness'],
    })

    expect(session.unlockedAvatarIds).toEqual(['avatar_guide'])
    expect(available.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_guide'])
  })

  it('keeps the unlock list captured at session start when the scenario gains an Avatar', async () => {
    const { session, sessions, avatars } = await startSession({ initialAvatarIds: [] })
    await avatars.create({
      scenarioId: 'scenario_1',
      name: 'Latecomer',
      status: 'active',
      personaPrompt: 'Latecomer',
      config: {},
    })

    const available = await new GetAvailableAvatarsUseCase(sessions, avatars).execute({
      sessionId: session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Guide', 'Witness'])
  })

  it('gives the Avatar prompt the same availability as the available-Avatars endpoint', async () => {
    const { session, available } = await startSession({
      initialAvatarIds: ['avatar_guide'],
      unlockableAvatarIds: ['avatar_witness'],
    })

    const awareness = buildAvatarAwareness(
      guide,
      [guide, witness, retired],
      session.unlockedAvatarIds,
    )
    const availableNames = available.avatars.map((avatar) => avatar.name)

    expect(awareness).toEqual([
      expect.objectContaining({ name: 'Witness', availability: 'locked' }),
    ])
    expect(availableNames).not.toContain('Witness')
  })
})
