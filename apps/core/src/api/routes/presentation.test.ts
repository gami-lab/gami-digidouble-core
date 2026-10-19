import { describe, expect, it } from 'vitest'
import type {
  ApiResponse,
  AvatarSummary,
  GetAvailableAvatarsResponse,
  ListPublicScenariosResponse,
  ScenarioSummary,
} from '@gami/shared'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'
import { playerHeaders, serviceKeyHeaders } from './test-auth.js'

const scenarioPresentation = {
  cover: 'https://cdn.example.com/cover.jpg',
  tagline: 'One night in the house',
  introText: 'The doors close behind you.',
  entryQuestion: { prompt: 'What should we call you?', personaField: 'name' },
  outroText: 'Come back soon.',
} as const

const avatarPresentation = {
  portrait: 'https://cdn.example.com/ava.png',
  hook: 'Knows every secret of the house',
  starterQuestions: ['Who are you?', 'What happened here?'],
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'House',
    status: 'active',
    language: 'en',
    objectives: [],
    worldContext: 'hidden world',
    avatarAvailability: { initialAvatarIds: ['avatar_1'] },
    config: { goals: ['hidden goal'], uiHints: scenarioPresentation },
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'hidden persona prompt',
    computedTraits: {
      identity: [],
      personality: [],
      speakingStyle: [],
      background: [],
      timeline: [],
      currentSituation: [],
      behaviouralRules: [],
    },
    config: { scope: 'hidden scope', uiHints: avatarPresentation },
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeApp(): ReturnType<typeof createServer> {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository([makeScenario()]),
    avatarRepository: new InMemoryAvatarRepository([makeAvatar()]),
    sessionRepository: new InMemorySessionRepository(),
  })
}

const adminJson = { ...serviceKeyHeaders(), 'content-type': 'application/json' }

describe('scenario presentation authoring', () => {
  it('creates a scenario with presentation and keeps it out of config', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: adminJson,
      payload: { name: 'Night', presentation: { ...scenarioPresentation, tagline: '  Night  ' } },
    })

    expect(response.statusCode).toBe(201)
    const scenario = response.json<ApiResponse<{ scenario: ScenarioSummary }>>().data?.scenario
    expect(scenario?.presentation).toEqual({ ...scenarioPresentation, tagline: 'Night' })
    expect(scenario?.config).toEqual({})
  })

  it.each([
    ['an unknown key', { accentColor: '#fff' }],
    ['a non-http cover', { cover: 'javascript:alert(1)' }],
    [
      'an admin-only persona field',
      { entryQuestion: { prompt: 'Why?', personaField: 'dialogGuidance' } },
    ],
    ['a blank tagline', { tagline: '   ' }],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, presentation) => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: adminJson,
      payload: { name: 'Night', presentation },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects presentation smuggled inside config', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: adminJson,
      payload: { name: 'Night', config: { uiHints: { tagline: 'x' } } },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('replaces presentation whole, keeps it across config updates, and clears it with null', async () => {
    const app = makeApp()
    const patch = async (payload: object): Promise<ScenarioSummary | undefined> => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/admin/scenarios/scenario_1',
        headers: adminJson,
        payload,
      })
      expect(response.statusCode).toBe(200)
      return response.json<ApiResponse<{ scenario: ScenarioSummary }>>().data?.scenario
    }

    expect((await patch({ presentation: { tagline: 'New' } }))?.presentation).toEqual({
      tagline: 'New',
    })
    const configUpdated = await patch({ config: { goals: ['other'] } })
    expect(configUpdated?.presentation).toEqual({ tagline: 'New' })
    expect(configUpdated?.config).toEqual({ goals: ['other'] })
    expect((await patch({ presentation: null }))?.presentation).toBeUndefined()
  })
})

describe('avatar presentation authoring', () => {
  it('updates, limits, and clears avatar presentation', async () => {
    const app = makeApp()
    const patch = (payload: object) =>
      app.inject({
        method: 'PATCH',
        url: '/v1/admin/avatars/avatar_1',
        headers: adminJson,
        payload,
      })

    const tooMany = await patch({ presentation: { starterQuestions: ['a', 'b', 'c', 'd'] } })
    expect(tooMany.statusCode).toBe(400)
    expect(tooMany.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')

    const updated = await patch({ presentation: { hook: 'A new hook' } })
    expect(updated.statusCode).toBe(200)
    const avatar = updated.json<ApiResponse<{ avatar: AvatarSummary }>>().data?.avatar
    expect(avatar?.presentation).toEqual({ hook: 'A new hook' })
    expect(avatar?.config).toEqual({ scope: 'hidden scope' })

    const cleared = await patch({ presentation: null })
    expect(
      cleared.json<ApiResponse<{ avatar: AvatarSummary }>>().data?.avatar.presentation,
    ).toBeUndefined()
  })
})

describe('player projections', () => {
  it('exposes scenario presentation in the public catalogue and no other config', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/scenarios',
      headers: playerHeaders(),
    })

    expect(response.json<ApiResponse<ListPublicScenariosResponse>>().data?.scenarios).toEqual([
      {
        scenarioId: 'scenario_1',
        name: 'House',
        language: 'en',
        presentation: scenarioPresentation,
      },
    ])
    expect(response.body).not.toContain('hidden')
  })

  it('exposes avatar presentation on available avatars and no other config', async () => {
    const app = makeApp()
    const started = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: playerHeaders(),
      payload: { scenarioId: 'scenario_1' },
    })
    const sessionId =
      started.json<ApiResponse<{ session: { sessionId: string } }>>().data?.session.sessionId

    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${sessionId ?? ''}/available-avatars`,
      headers: playerHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const avatars = response.json<ApiResponse<GetAvailableAvatarsResponse>>().data?.avatars
    expect(avatars?.[0]?.presentation).toEqual(avatarPresentation)
    expect(response.body).not.toContain('hidden')
  })
})
