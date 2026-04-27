import { describe, expect, it } from 'vitest'
import {
  buildAiGuidedDiscoveryAvatarSeedParams,
  buildAiGuidedDiscoveryFixture,
} from './ai-guided-discovery.js'

describe('ai-guided-discovery seed data derivation', () => {
  it('derives fixture avatar product fields from the same source as seed params', () => {
    const { scenario, avatars } = buildAiGuidedDiscoveryFixture()
    const seedParams = buildAiGuidedDiscoveryAvatarSeedParams(scenario.scenarioId)

    const fixtureByRouteKey = new Map(avatars.map((avatar) => [avatar.config['routeKey'], avatar]))

    for (const seedParam of seedParams) {
      const routeKey = seedParam.config?.['routeKey']
      expect(typeof routeKey).toBe('string')

      const fixtureAvatar = fixtureByRouteKey.get(routeKey)
      expect(fixtureAvatar).toBeDefined()
      expect(fixtureAvatar?.name).toBe(seedParam.name)
      expect(fixtureAvatar?.status).toBe(seedParam.status)
      expect(fixtureAvatar?.description).toBe(seedParam.description)
      expect(fixtureAvatar?.tone).toBe(seedParam.tone)
      expect(fixtureAvatar?.personaPrompt).toBe(seedParam.personaPrompt)
      expect(fixtureAvatar?.config).toEqual(seedParam.config)
    }
  })

  it('keeps deterministic fixture avatar IDs', () => {
    const { avatars } = buildAiGuidedDiscoveryFixture()

    expect(avatars.map((avatar) => avatar.avatarId)).toEqual([
      'avatar_mira',
      'avatar_theo',
      'avatar_eva',
    ])
  })

  it('injects scenarioId at seed mapping time', () => {
    const seedParams = buildAiGuidedDiscoveryAvatarSeedParams('scenario_custom')

    expect(seedParams).toHaveLength(3)
    expect(seedParams.every((seedParam) => seedParam.scenarioId === 'scenario_custom')).toBe(true)
  })
})
