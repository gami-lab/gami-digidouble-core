import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSummary, ScenarioSummary } from '@gami/shared'
import { adminRequest } from './client'
import {
  createAvatar,
  createScenario,
  deleteAvatar,
  getScenario,
  listScenarioAvatars,
  listScenarios,
  updateAvatar,
  updateScenario,
} from './scenarios'

vi.mock('./client', () => ({
  adminRequest: vi.fn(),
}))

function makeScenario(): ScenarioSummary {
  return {
    scenarioId: 'scenario_1',
    name: 'Villa Miralac',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

function makeAvatar(): AvatarSummary {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Clara',
    status: 'active',
    personaPrompt: 'You are Clara.',
    computedTraits: null,
    config: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('scenarios API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists scenarios', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ scenarios: [makeScenario()] })

    const result = await listScenarios()

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/scenarios')
    expect(result).toHaveLength(1)
  })

  it('gets a single scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ scenario: makeScenario() })

    const result = await getScenario('scenario_1')

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/scenarios/scenario_1')
    expect(result.scenarioId).toBe('scenario_1')
  })

  it('creates a scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ scenario: makeScenario() })

    await createScenario({ name: 'Villa Miralac', status: 'active' })

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/scenarios', {
      name: 'Villa Miralac',
      status: 'active',
    })
  })

  it('updates a scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ scenario: makeScenario() })

    await updateScenario('scenario_1', { name: 'Renamed' })

    expect(adminRequest).toHaveBeenCalledWith('PATCH', '/v1/scenarios/scenario_1', {
      name: 'Renamed',
    })
  })

  it('lists avatars for a scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ avatars: [makeAvatar()] })

    const result = await listScenarioAvatars('scenario_1')

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/scenarios/scenario_1/avatars')
    expect(result).toHaveLength(1)
  })

  it('creates an avatar for a scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ avatar: makeAvatar() })

    await createAvatar('scenario_1', { name: 'Clara', personaPrompt: 'You are Clara.' })

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/scenarios/scenario_1/avatars', {
      name: 'Clara',
      personaPrompt: 'You are Clara.',
    })
  })

  it('updates an avatar', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ avatar: makeAvatar() })

    await updateAvatar('avatar_1', { name: 'Clara Whitcombe' })

    expect(adminRequest).toHaveBeenCalledWith('PATCH', '/v1/avatars/avatar_1', {
      name: 'Clara Whitcombe',
    })
  })

  it('deletes an avatar', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ avatarId: 'avatar_1', deleted: true })

    await deleteAvatar('avatar_1')

    expect(adminRequest).toHaveBeenCalledWith('DELETE', '/v1/avatars/avatar_1')
  })
})
