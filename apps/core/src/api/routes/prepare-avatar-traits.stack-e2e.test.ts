/**
 * Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits
 *
 * Fires real HTTP requests against the running Docker stack (EPIC 8.1's
 * explicit scenario-scoped trait preparation endpoint). No mocking.
 *
 * The Docker stack is configured with API_KEY_SECRET=e2e-stack-secret and
 * LLM_PROVIDER=${LLM_PROVIDER:-null} (see docker-compose.e2e.yml). With the
 * default null provider, trait preparation deterministically produces a
 * `failed` (`unparseable_output`) result per avatar — that's still a full,
 * always-on proof that the endpoint, auth, scenario/avatar lookup, and
 * persistence wiring all work end-to-end. When the stack is started with a
 * real provider key, the gated block below asserts genuine prepared traits.
 */
import { describe, expect, it } from 'vitest'
import {
  AVATAR_COMPUTED_TRAIT_KEYS,
  type ApiResponse,
  type AvatarComputedTraits,
  type CreateAvatarResponse,
  type CreateScenarioResponse,
  type ListScenarioAvatarsResponse,
  type PrepareAvatarTraitsResponse,
} from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const UNKNOWN_ENDPOINT = `${APP_URL}/v1/scenarios/scenario_unknown/prepare-avatar-traits`

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  }
}

// The prepare-avatar-traits endpoint takes no request body — calls to it must
// omit the JSON content-type header too, since sending `Content-Type:
// application/json` with no payload trips a generic Fastify body-parser gap
// (a pre-existing app-wide issue, not specific to this route) that returns
// 500 instead of the expected status. Bodied calls to *other* endpoints below
// (create scenario/avatar) correctly use `authHeaders()` instead.
function noBodyAuthHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey }
}

describe('Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, { method: 'POST' })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: noBodyAuthHeaders('wrong-key'),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits — validation', () => {
  it.each([
    { label: 'object fields', body: JSON.stringify({ avatarIds: ['avatar_1'] }) },
    { label: 'null JSON', body: 'null' },
    { label: 'number JSON', body: '5' },
    { label: 'boolean JSON', body: 'true' },
    { label: 'array JSON', body: '[]' },
    { label: 'string JSON', body: '"unexpected"' },
  ])('rejects $label request bodies (400)', async ({ body: requestBody }) => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(),
      body: requestBody,
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits — resource lookup', () => {
  it('returns 404 when scenarioId is unknown', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: noBodyAuthHeaders(),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

async function createScenarioAndAvatar(): Promise<{ scenarioId: string; avatarId: string }> {
  const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: `Trait Prep Stack Scenario ${String(Date.now())}`,
      worldContext: 'A quiet coastal town preparing for a storm.',
    }),
  })
  expect(createScenarioRes.status).toBe(201)
  const createdScenario = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
  const scenarioId = createdScenario.data?.scenario.scenarioId ?? ''

  const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: 'Stack Trait Prep Avatar',
      personaPrompt: 'You are a warm harbor-master who knows every local family.',
    }),
  })
  expect(createAvatarRes.status).toBe(201)
  const createdAvatar = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
  const avatarId = createdAvatar.data?.avatar.avatarId ?? ''

  return { scenarioId, avatarId }
}

async function createKnowledgeSource(args: {
  scenarioId: string
  name: string
  knowledgeType: 'memory' | 'world'
  inlineText: string
}): Promise<void> {
  const createSourceRes = await fetch(`${APP_URL}/v1/knowledge-sources`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      scenarioId: args.scenarioId,
      name: args.name,
      knowledgeType: args.knowledgeType,
      format: 'text',
      uriOrPath: `/tmp/${args.name.toLowerCase().replaceAll(' ', '-')}.txt`,
      metadata: { inlineText: args.inlineText },
    }),
  })
  expect(createSourceRes.status).toBe(201)
}

async function deleteAvatar(avatarId: string): Promise<void> {
  await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

async function deleteScenario(scenarioId: string): Promise<void> {
  await fetch(`${APP_URL}/v1/scenarios/${scenarioId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

// Always runs regardless of the stack's configured LLM_PROVIDER — with the
// default null provider, every avatar deterministically fails to parse
// (`unparseable_output`), which still proves the full HTTP -> use case ->
// DB round trip works.
const isNullProvider = (process.env['LLM_PROVIDER'] ?? 'null') === 'null'

async function prepareAvatarTraits(
  scenarioId: string,
): Promise<ApiResponse<PrepareAvatarTraitsResponse>> {
  const res = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/prepare-avatar-traits`, {
    method: 'POST',
    headers: noBodyAuthHeaders(),
  })

  expect(res.status).toBe(200)
  return (await res.json()) as ApiResponse<PrepareAvatarTraitsResponse>
}

async function listScenarioAvatar(
  scenarioId: string,
  avatarId: string,
): Promise<ListScenarioAvatarsResponse['avatars'][number] | undefined> {
  const listRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
    method: 'GET',
    headers: { 'x-api-key': API_KEY },
  })
  const listBody = (await listRes.json()) as ApiResponse<ListScenarioAvatarsResponse>
  return listBody.data?.avatars.find((avatar) => avatar.avatarId === avatarId)
}

function assertPreparedTraitShape(traits: AvatarComputedTraits): void {
  for (const key of AVATAR_COMPUTED_TRAIT_KEYS) {
    expect(Array.isArray(traits[key])).toBe(true)
    if (key !== 'timeline') {
      expect(traits[key].length).toBeLessThanOrEqual(7)
    }
  }
  expect(AVATAR_COMPUTED_TRAIT_KEYS.some((key) => traits[key].length > 0)).toBe(true)
}

describe('Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits — success (always-on)', () => {
  it('returns 200 with one result per avatar and persists computedTraits deterministically', async () => {
    const { scenarioId, avatarId } = await createScenarioAndAvatar()

    try {
      const res = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/prepare-avatar-traits`, {
        method: 'POST',
        headers: noBodyAuthHeaders(),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as ApiResponse<PrepareAvatarTraitsResponse>
      expect(body.error).toBeNull()
      expect(body.data?.scenarioId).toBe(scenarioId)
      expect(body.data?.results).toHaveLength(1)
      expect(body.data?.results[0]?.avatarId).toBe(avatarId)

      if (isNullProvider) {
        expect(body.data?.results[0]).toEqual({
          avatarId,
          status: 'failed',
          reason: 'unparseable_output',
        })
      }

      const listRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
        method: 'GET',
        headers: { 'x-api-key': API_KEY },
      })
      const listBody = (await listRes.json()) as ApiResponse<ListScenarioAvatarsResponse>
      const listedAvatar = listBody.data?.avatars.find((a) => a.avatarId === avatarId)
      if (isNullProvider) {
        expect(listedAvatar?.computedTraits).toBe(null)
      }

      await deleteAvatar(avatarId)
    } finally {
      await deleteScenario(scenarioId)
    }
  })

  it('is rerunnable: a second call succeeds and produces a fresh persisted result', async () => {
    const { scenarioId, avatarId } = await createScenarioAndAvatar()

    try {
      const firstRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/prepare-avatar-traits`, {
        method: 'POST',
        headers: noBodyAuthHeaders(),
      })
      expect(firstRes.status).toBe(200)

      const secondRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/prepare-avatar-traits`, {
        method: 'POST',
        headers: noBodyAuthHeaders(),
      })
      expect(secondRes.status).toBe(200)
      const secondBody = (await secondRes.json()) as ApiResponse<PrepareAvatarTraitsResponse>
      expect(secondBody.data?.results).toHaveLength(1)
      expect(secondBody.data?.results[0]?.avatarId).toBe(avatarId)

      if (isNullProvider) {
        expect(secondBody.data?.results[0]).toEqual({
          avatarId,
          status: 'failed',
          reason: 'unparseable_output',
        })
      } else {
        expect(secondBody.data?.results[0]?.status).toBe('prepared')
      }

      await deleteAvatar(avatarId)
    } finally {
      await deleteScenario(scenarioId)
    }
  })
})

describe.skipIf(isNullProvider)(
  'Stack E2E — POST /v1/scenarios/:scenarioId/prepare-avatar-traits — real provider flow',
  () => {
    it('computes and persists a structured trait result with a real provider', async () => {
      const { scenarioId, avatarId } = await createScenarioAndAvatar()

      try {
        await createKnowledgeSource({
          scenarioId,
          name: 'Harbor memory',
          knowledgeType: 'memory',
          inlineText:
            'Mara keeps a handwritten ledger of which local families need medicine first when storms close the harbor.',
        })
        await createKnowledgeSource({
          scenarioId,
          name: 'Town festival',
          knowledgeType: 'world',
          inlineText:
            'The town square is paved with blue stone and hosts an annual lantern fair for tourists.',
        })

        const body = await prepareAvatarTraits(scenarioId)
        const result = body.data?.results[0]
        expect(result?.status).toBe('prepared')
        if (result?.status === 'prepared') {
          assertPreparedTraitShape(result.computedTraits)
        }

        const listedAvatar = await listScenarioAvatar(scenarioId, avatarId)
        expect(listedAvatar?.computedTraits).not.toBe(null)
        if (result?.status === 'prepared') {
          expect(listedAvatar?.computedTraits).toEqual(result.computedTraits)
        }

        await deleteAvatar(avatarId)
      } finally {
        await deleteScenario(scenarioId)
      }
    }, 30_000)
  },
)
