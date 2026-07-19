import { describe, expect, it, vi } from 'vitest'
import type { ApiResponse, AvatarComputedTraits, PrepareAvatarTraitsResponse } from '@gami/shared'
import type { ILlmAdapter, LlmRequest } from '../../application/ports/ILlmAdapter.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

type CreateScenarioRouteData = { scenario: { scenarioId: string } }
type CreateAvatarRouteData = { avatar: { avatarId: string; computedTraits: unknown } }

const sampleTraits: AvatarComputedTraits = {
  identity: ['A guide'],
  personality: ['Curious'],
  speakingStyle: ['Short sentences'],
  background: ['Former teacher'],
  timeline: ['Joined at story start'],
  currentSituation: ['Welcoming visitors'],
  behaviouralRules: ['No spoilers'],
}

/** Fake LLM adapter that always returns a valid trait-preparation JSON payload. */
function createDeterministicTraitLlm(): ILlmAdapter {
  return {
    complete: vi.fn((_request: LlmRequest) =>
      Promise.resolve({
        content: JSON.stringify(sampleTraits),
        model: 'test-model',
        inputTokens: 10,
        outputTokens: 10,
        latencyMs: 1,
      }),
    ),
  }
}

async function createScenarioAndAvatar(
  app: ReturnType<typeof createServer>,
): Promise<{ scenarioId: string; avatarId: string }> {
  const createScenarioResponse = await app.inject({
    method: 'POST',
    url: '/v1/scenarios',
    headers: { 'x-api-key': 'test-secret' },
    payload: { name: 'Trait Prep Scenario' },
  })
  const scenarioId =
    createScenarioResponse.json<ApiResponse<CreateScenarioRouteData>>().data?.scenario.scenarioId ??
    ''

  const createAvatarResponse = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/avatars`,
    headers: { 'x-api-key': 'test-secret' },
    payload: { name: 'Ava', personaPrompt: 'You are Ava, a warm local guide.' },
  })
  const avatarId =
    createAvatarResponse.json<ApiResponse<CreateAvatarRouteData>>().data?.avatar.avatarId ?? ''

  return { scenarioId, avatarId }
}

describe('POST /v1/scenarios/:scenarioId/prepare-avatar-traits — auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
      headers: { 'x-api-key': 'wrong-secret' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /v1/scenarios/:scenarioId/prepare-avatar-traits — validation', () => {
  it.each([
    { label: 'object fields', payload: JSON.stringify({ avatarIds: ['avatar_1'] }) },
    { label: 'null JSON', payload: 'null' },
    { label: 'number JSON', payload: '5' },
    { label: 'boolean JSON', payload: 'true' },
    { label: 'array JSON', payload: '[]' },
    { label: 'string JSON', payload: '"unexpected"' },
  ])('returns 400 when a bodied request sends $label', async ({ payload }) => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
      headers: { 'x-api-key': 'test-secret', 'content-type': 'application/json' },
      payload,
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('accepts a request sent with no body at all', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).not.toBe(400)
  })
})

describe('POST /v1/scenarios/:scenarioId/prepare-avatar-traits — resource lookup', () => {
  it('returns 404 when the scenario does not exist', async () => {
    const response = await createServer(TEST_CONFIG).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/prepare-avatar-traits',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('POST /v1/scenarios/:scenarioId/prepare-avatar-traits — success', () => {
  it('computes and persists computedTraits with a deterministic fake LLM response', async () => {
    const app = createServer(TEST_CONFIG, { llmAdapter: createDeterministicTraitLlm() })
    const { scenarioId, avatarId } = await createScenarioAndAvatar(app)

    const listBeforeResponse = await app.inject({
      method: 'GET',
      url: `/v1/scenarios/${scenarioId}/avatars`,
      headers: { 'x-api-key': 'test-secret' },
    })
    const listBeforeBody =
      listBeforeResponse.json<
        ApiResponse<{ avatars: Array<{ avatarId: string; computedTraits: unknown }> }>
      >()
    expect(listBeforeBody.data?.avatars.find((a) => a.avatarId === avatarId)?.computedTraits).toBe(
      null,
    )

    const prepareResponse = await app.inject({
      method: 'POST',
      url: `/v1/scenarios/${scenarioId}/prepare-avatar-traits`,
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(prepareResponse.statusCode).toBe(200)
    const prepareBody = prepareResponse.json<ApiResponse<PrepareAvatarTraitsResponse>>()
    expect(prepareBody.error).toBeNull()
    expect(prepareBody.data?.scenarioId).toBe(scenarioId)
    expect(prepareBody.data?.results).toEqual([
      { avatarId, status: 'prepared', computedTraits: sampleTraits },
    ])

    const listAfterResponse = await app.inject({
      method: 'GET',
      url: `/v1/scenarios/${scenarioId}/avatars`,
      headers: { 'x-api-key': 'test-secret' },
    })
    const listAfterBody =
      listAfterResponse.json<
        ApiResponse<{ avatars: Array<{ avatarId: string; computedTraits: unknown }> }>
      >()
    expect(
      listAfterBody.data?.avatars.find((a) => a.avatarId === avatarId)?.computedTraits,
    ).toEqual(sampleTraits)
  })

  it('returns an empty results list for a scenario with no avatars', async () => {
    const app = createServer(TEST_CONFIG, { llmAdapter: createDeterministicTraitLlm() })
    const createScenarioResponse = await app.inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Empty Scenario' },
    })
    const scenarioId =
      createScenarioResponse.json<ApiResponse<CreateScenarioRouteData>>().data?.scenario
        .scenarioId ?? ''

    const response = await app.inject({
      method: 'POST',
      url: `/v1/scenarios/${scenarioId}/prepare-avatar-traits`,
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<PrepareAvatarTraitsResponse>>()
    expect(body.data).toEqual({ scenarioId, results: [] })
  })
})
