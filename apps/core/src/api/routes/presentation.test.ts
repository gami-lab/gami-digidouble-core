import { describe, expect, it } from 'vitest'
import { PRESENTATION_LIMITS, isAvatarPresentation, isScenarioPresentation } from '@gami/shared'
import type {
  ApiResponse,
  AvatarSummary,
  GetAvailableAvatarsResponse,
  ListPublicScenariosResponse,
  ScenarioSummary,
} from '@gami/shared'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { MediaAsset } from '../../domain/media/media-asset.types.js'
import { InMemoryMediaAssetRepository } from '../../infrastructure/db/in-memory-media-asset.repository.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'
import { playerHeaders, serviceKeyHeaders } from './test-auth.js'

function makeAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, 'assetId'>): MediaAsset {
  return {
    scenarioId: 'scenario_1',
    kind: 'image',
    source: 'upload',
    storageKey: `${overrides.assetId}.bin`,
    url: null,
    mimeType: 'image/png',
    byteSize: 10,
    posterAssetId: null,
    durationMs: null,
    description: 'hidden-free description',
    cueable: false,
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }
}

const ASSETS = [
  makeAsset({ assetId: 'media_cover', description: 'The house at night' }),
  makeAsset({
    assetId: 'media_intro',
    kind: 'video',
    mimeType: 'video/mp4',
    posterAssetId: 'media_cover',
    durationMs: 12_000,
    description: 'Arrival at the house',
  }),
  makeAsset({ assetId: 'media_portrait', description: 'Ava smiling' }),
  makeAsset({
    assetId: 'media_idle',
    kind: 'video',
    source: 'url',
    storageKey: null,
    url: 'https://cdn.example.com/idle.mp4',
    mimeType: 'video/mp4',
    description: 'Ava breathing',
  }),
  makeAsset({ assetId: 'media_foreign', scenarioId: 'scenario_2' }),
]

const scenarioPresentation = {
  cover: 'media_cover',
  tagline: 'One night in the house',
  introText: 'The doors close behind you.',
  introMedia: 'media_intro',
  entryQuestion: { prompt: 'What should we call you?', personaField: 'name' },
  outroText: 'Come back soon.',
} as const

const avatarPresentation = {
  portrait: 'media_portrait',
  idleLoop: 'media_idle',
  hook: 'Knows every secret of the house',
  starterQuestions: ['Who are you?', 'What happened here?'],
}

const publicCover = {
  assetId: 'media_cover',
  kind: 'image',
  url: '/v1/media/media_cover',
  description: 'The house at night',
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

function makeApp(assets: MediaAsset[] = ASSETS): ReturnType<typeof createServer> {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository([makeScenario()]),
    avatarRepository: new InMemoryAvatarRepository([makeAvatar()]),
    sessionRepository: new InMemorySessionRepository(),
    mediaAssetRepository: new InMemoryMediaAssetRepository(assets),
  })
}

async function patchScenario(
  app: ReturnType<typeof createServer>,
  payload: object,
): Promise<{ statusCode: number; body: ApiResponse<{ scenario: ScenarioSummary }> }> {
  const response = await app.inject({
    method: 'PATCH',
    url: '/v1/admin/scenarios/scenario_1',
    headers: adminJson,
    payload,
  })
  return { statusCode: response.statusCode, body: response.json() }
}

const adminJson = { ...serviceKeyHeaders(), 'content-type': 'application/json' }

describe('scenario presentation authoring', () => {
  it('creates a scenario with presentation and keeps it out of config', async () => {
    const textOnly = {
      tagline: scenarioPresentation.tagline,
      introText: scenarioPresentation.introText,
      entryQuestion: scenarioPresentation.entryQuestion,
    }
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/admin/scenarios',
      headers: adminJson,
      payload: { name: 'Night', presentation: { ...textOnly, tagline: '  Night  ' } },
    })

    expect(response.statusCode).toBe(201)
    const scenario = response.json<ApiResponse<{ scenario: ScenarioSummary }>>().data?.scenario
    expect(scenario?.presentation).toEqual({ ...textOnly, tagline: 'Night' })
    expect(scenario?.config).toEqual({})
  })

  it.each([
    ['an unknown key', { accentColor: '#fff' }],
    ['a URL instead of a media ref', { cover: 'https://cdn.example.com/cover.jpg' }],
    ['a media ref before the scenario has assets', { cover: 'media_cover' }],
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

describe('presentation media references', () => {
  it('stores refs to assets of the scenario whose kind fits the slot', async () => {
    const updated = await patchScenario(makeApp(), {
      presentation: { cover: 'media_cover', introMedia: 'media_intro', outroMedia: 'media_cover' },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.body.data?.scenario.presentation).toEqual({
      cover: 'media_cover',
      introMedia: 'media_intro',
      outroMedia: 'media_cover',
    })
  })

  it.each([
    ['an unknown asset', { cover: 'media_missing' }],
    ['an asset of another scenario', { cover: 'media_foreign' }],
    ['a video in an image-only slot', { cover: 'media_intro' }],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, presentation) => {
    const updated = await patchScenario(makeApp(), { presentation })

    expect(updated.statusCode).toBe(400)
    expect(updated.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an image as the avatar idle loop', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: '/v1/admin/avatars/avatar_1',
      headers: adminJson,
      payload: { presentation: { idleLoop: 'media_portrait' } },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
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
        presentation: {
          ...scenarioPresentation,
          cover: publicCover,
          introMedia: {
            assetId: 'media_intro',
            kind: 'video',
            url: '/v1/media/media_intro',
            posterUrl: '/v1/media/media_cover',
            durationMs: 12_000,
            description: 'Arrival at the house',
          },
        },
      },
    ])
    expect(response.body).not.toContain('hidden')
    expect(response.body).not.toContain('storageKey')
  })

  it('omits media slots whose asset no longer resolves', async () => {
    const response = await makeApp([]).inject({
      method: 'GET',
      url: '/v1/scenarios',
      headers: playerHeaders(),
    })

    const presentation =
      response.json<ApiResponse<ListPublicScenariosResponse>>().data?.scenarios[0]?.presentation
    expect(presentation).not.toHaveProperty('cover')
    expect(presentation).not.toHaveProperty('introMedia')
    expect(presentation?.tagline).toBe(scenarioPresentation.tagline)
  })
})

describe('player avatar projections', () => {
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
    expect(avatars?.[0]?.presentation).toEqual({
      ...avatarPresentation,
      portrait: {
        assetId: 'media_portrait',
        kind: 'image',
        url: '/v1/media/media_portrait',
        description: 'Ava smiling',
      },
      idleLoop: {
        assetId: 'media_idle',
        kind: 'video',
        url: 'https://cdn.example.com/idle.mp4',
        description: 'Ava breathing',
      },
    })
    expect(response.body).not.toContain('hidden')
  })

  it('round-trips admin-authored starter questions and portrait to the player', async () => {
    const app = makeApp()
    const authored = {
      portrait: 'media_cover',
      starterQuestions: ['Where were you?'],
    }
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/avatars/avatar_1',
      headers: adminJson,
      payload: { presentation: authored },
    })
    const started = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: playerHeaders(),
      payload: { scenarioId: 'scenario_1' },
    })
    const sessionId =
      started.json<ApiResponse<{ session: { sessionId: string } }>>().data?.session.sessionId ?? ''

    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${sessionId}/available-avatars`,
      headers: playerHeaders(),
    })

    expect(
      response.json<ApiResponse<GetAvailableAvatarsResponse>>().data?.avatars[0]?.presentation,
    ).toEqual({ ...authored, portrait: publicCover })
  })
})

describe('presentation rules: route schema and shared guard agree', () => {
  const long = (max: number): string => 'x'.repeat(max + 1)
  const scenarioCases: unknown[] = [
    {},
    scenarioPresentation,
    { cover: 'media_cover' },
    { cover: 'https://cdn.example.com/a.png' },
    { introMedia: 'media_../etc' },
    { outroMedia: `media_${long(64)}` },
    { tagline: long(PRESENTATION_LIMITS.taglineMaxLength) },
    { introText: ' ' },
    { outroText: long(PRESENTATION_LIMITS.outroTextMaxLength) },
    { entryQuestion: { prompt: 'Who?', personaField: 'roleInWorld' } },
    { entryQuestion: { prompt: 'Who?' } },
    { entryQuestion: { prompt: 'Who?', personaField: 'name', extra: true } },
    { tagline: 'ok', unknown: 'x' },
  ]
  const avatarCases: unknown[] = [
    {},
    avatarPresentation,
    { portrait: 'not a ref' },
    { idleLoop: 'media_idle' },
    { hook: long(PRESENTATION_LIMITS.hookMaxLength) },
    { starterQuestions: [] },
    { starterQuestions: ['a', 'b', 'c'] },
    { starterQuestions: ['a', 'b', 'c', 'd'] },
    { starterQuestions: [long(PRESENTATION_LIMITS.starterQuestionMaxLength)] },
    { starterQuestions: ['  '] },
    { hook: 'ok', accentColor: '#fff' },
  ]

  it.each(scenarioCases)('scenario %#', async (presentation) => {
    const updated = await patchScenario(makeApp(), { presentation })
    expect(updated.statusCode === 200).toBe(isScenarioPresentation(presentation))
  })

  it.each(avatarCases)('avatar %#', async (presentation) => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: '/v1/admin/avatars/avatar_1',
      headers: adminJson,
      payload: { presentation },
    })
    expect(response.statusCode === 200).toBe(isAvatarPresentation(presentation))
  })
})
