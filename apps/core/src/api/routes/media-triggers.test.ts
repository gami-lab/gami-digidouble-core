import { describe, expect, it, vi } from 'vitest'
import type {
  ApiResponse,
  AvatarSummary,
  CreateAvatarResponse,
  GetAvailableAvatarsResponse,
} from '@gami/shared'
import { makeAvatarConfig } from '../../domain/avatar/avatar.fixtures.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryMediaAssetRepository } from '../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemorySessionEventPublisher } from '../../infrastructure/events/in-memory-session-event-publisher.js'
import { makeMediaAsset } from '../../test-utils/media.js'
import { createServer } from '../server.js'
import { playerHeaders, serviceKeyHeaders } from './test-auth.js'
import { TEST_CONFIG } from './test-config.js'

const scenario: Scenario = {
  scenarioId: 'scenario_1',
  name: 'House',
  status: 'active',
  language: 'en',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: ['avatar_1'] },
  config: {},
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
}

function makeApp() {
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository([scenario]),
    avatarRepository: new InMemoryAvatarRepository([
      makeAvatarConfig({ avatarId: 'avatar_1', scenarioId: 'scenario_1', status: 'active' }),
    ]),
    sessionRepository: new InMemorySessionRepository(),
    mediaAssetRepository: new InMemoryMediaAssetRepository([
      makeMediaAsset({ assetId: 'media_reveal', kind: 'video', mimeType: 'video/mp4' }),
      makeMediaAsset({ assetId: 'media_cut' }),
      makeMediaAsset({ assetId: 'media_foreign', scenarioId: 'scenario_2' }),
    ]),
  })
}

function patchAvatar(app: ReturnType<typeof makeApp>, payload: object) {
  return app.inject({
    method: 'PATCH',
    url: '/v1/admin/avatars/avatar_1',
    headers: serviceKeyHeaders(),
    payload,
  })
}

describe('avatar media triggers', () => {
  it('round-trips triggers on the admin projection and keeps them out of config', async () => {
    const app = makeApp()
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios/scenario_1/avatars',
      headers: serviceKeyHeaders(),
      payload: {
        name: 'Max',
        personaPrompt: 'You are Max.',
        mediaTriggers: { onUnlock: 'media_reveal' },
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json<ApiResponse<CreateAvatarResponse>>().data?.avatar).toMatchObject({
      mediaTriggers: { onUnlock: 'media_reveal' },
      config: {},
    })

    const updated = await patchAvatar(app, { mediaTriggers: { onSwitchTo: 'media_cut' } })
    const avatar = updated.json<ApiResponse<{ avatar: AvatarSummary }>>().data?.avatar
    expect(avatar?.mediaTriggers).toEqual({ onSwitchTo: 'media_cut' })

    const kept = await patchAvatar(app, { config: { scope: 'new' } })
    expect(kept.json<ApiResponse<{ avatar: AvatarSummary }>>().data?.avatar.mediaTriggers).toEqual({
      onSwitchTo: 'media_cut',
    })
    const cleared = await patchAvatar(app, { mediaTriggers: null })
    expect(
      cleared.json<ApiResponse<{ avatar: AvatarSummary }>>().data?.avatar.mediaTriggers,
    ).toBeUndefined()
  })

  it.each([
    ['a missing asset', { mediaTriggers: { onUnlock: 'media_missing' } }],
    ['an asset of another scenario', { mediaTriggers: { onUnlock: 'media_foreign' } }],
    ['an unknown trigger', { mediaTriggers: { onLeave: 'media_cut' } }],
    ['triggers inside config', { config: { mediaTriggers: { onUnlock: 'media_cut' } } }],
  ])('rejects %s with 400', async (_label, payload) => {
    const response = await patchAvatar(makeApp(), payload)

    expect(response.statusCode).toBe(400)
  })

  it('keeps triggers off the player projection', async () => {
    const app = makeApp()
    await patchAvatar(app, { mediaTriggers: { onUnlock: 'media_reveal' } })
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

    expect(response.json<ApiResponse<GetAvailableAvatarsResponse>>().data?.avatars).toHaveLength(1)
    expect(response.body).not.toContain('media_reveal')
  })

  it('blocks deleting an asset a trigger references', async () => {
    const app = makeApp()
    await patchAvatar(app, { mediaTriggers: { onUnlock: 'media_reveal' } })

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/media/media_reveal',
      headers: serviceKeyHeaders(),
    })

    expect(response.statusCode).toBe(409)
    expect(response.json<ApiResponse<null>>().error?.details).toMatchObject({
      usages: [expect.stringContaining('onUnlock')],
    })
  })
})

const PREPARED_TRAITS = {
  identity: [],
  personality: [],
  speakingStyle: [],
  background: [],
  timeline: [],
  currentSituation: [],
  behaviouralRules: [],
}

describe('switch media trigger', () => {
  it('publishes the switch-to cue on the session stream after the switch, once per switch', async () => {
    const publisher = new InMemorySessionEventPublisher()
    const sessions = new InMemorySessionRepository()
    const app = createServer(TEST_CONFIG, {
      scenarioRepository: new InMemoryScenarioRepository([
        { ...scenario, avatarAvailability: { initialAvatarIds: ['avatar_1', 'avatar_2'] } },
      ]),
      avatarRepository: new InMemoryAvatarRepository([
        makeAvatarConfig({
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          computedTraits: PREPARED_TRAITS,
        }),
        makeAvatarConfig({
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          computedTraits: PREPARED_TRAITS,
          config: { mediaTriggers: { onSwitchTo: 'media_cut' } },
        }),
      ]),
      sessionRepository: sessions,
      mediaAssetRepository: new InMemoryMediaAssetRepository([
        makeMediaAsset({ assetId: 'media_cut' }),
      ]),
      sessionEventPublisher: publisher,
    })
    const started = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: playerHeaders(),
      payload: { scenarioId: 'scenario_1' },
    })
    const sessionId =
      started.json<ApiResponse<{ session: { sessionId: string } }>>().data?.session.sessionId ?? ''
    const cues: unknown[] = []
    publisher.subscribe(sessionId, (event) => {
      if (event.type === 'runtime.media_cue') cues.push(event.payload)
    })
    const switchTo = (avatarId: string) =>
      app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/switch-avatar`,
        headers: playerHeaders(),
        payload: { avatarId },
      })

    expect((await switchTo('avatar_2')).statusCode).toBe(200)
    await vi.waitFor(() => {
      expect(cues).toHaveLength(1)
    })
    await switchTo('avatar_1')
    await switchTo('avatar_2')

    await vi.waitFor(() => {
      expect(cues).toHaveLength(2)
    })
    expect(cues[0]).toMatchObject({ origin: 'avatar_switched', asset: { assetId: 'media_cut' } })
  })
})
