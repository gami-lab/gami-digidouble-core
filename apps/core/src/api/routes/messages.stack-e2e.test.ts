/**
 * Stack E2E — POST /v1/conversations/:sessionId/messages
 *
 * Fires real HTTP requests against the running Docker stack.
 * No mocking. Requires APP_URL to point to a live server.
 *
 * Always-on tests (no LLM key or session seeding required):
 *   - auth rejection for missing / wrong key
 *   - schema validation rejection (missing required fields)
 *   - unknown session returns 404 with correct error code
 *
 * Full happy-path test:
 *   Creates scenario + avatar + session via API, then sends a message.
 *   Always runs — validates the full stack without requiring a real LLM key.
 *
 * The Docker stack is configured with API_KEY_SECRET=e2e-stack-secret and
 * LLM_PROVIDER=${LLM_PROVIDER:-null} (see docker-compose.e2e.yml).
 */
import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const ENDPOINT = `${APP_URL}/v1/conversations/sess_unknown/messages`
const isNullProvider = (process.env['LLM_PROVIDER'] ?? 'null') === 'null'

type CreateScenarioResponse = {
  scenario: {
    scenarioId: string
  }
}

type CreateAvatarResponse = {
  avatar: {
    avatarId: string
    scenarioId: string
  }
}

type StartSessionResponse = {
  session: {
    sessionId: string
  }
}

type SendMessageResponse = {
  session: {
    sessionId: string
  }
  userMessage: {
    content: string
  }
  avatarMessage: {
    content: string
    metadata: {
      model: string
      latencyMs: number
      inputTokens: number
      outputTokens: number
    }
  }
}

// ── Auth guard tests (always run) ────────────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(401)
  })
})

// ── Schema validation tests (always run) ─────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — validation', () => {
  it('rejects requests with missing message field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with missing avatarId field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ message: { content: 'hello' } }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with empty message content (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: '' } }),
    })

    expect(res.status).toBe(400)
  })
})

// ── Resource lookup (always run) ──────────────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — resource lookup', () => {
  it('returns 404 for an unknown sessionId with correct error envelope', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(404)

    const body = (await res.json()) as { data: null; error: { code: string } }
    expect(body.data).toBeNull()
    expect(body.error).not.toBeNull()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

// ── Shared setup helper ─────────────────────────────────────────────────────

async function createStackFixture(): Promise<{
  scenarioId: string
  avatarId: string
  sessionId: string
}> {
  const idSuffix = String(Date.now())

  const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      name: `Messages Stack Scenario ${idSuffix}`,
    }),
  })
  if (createScenarioRes.status !== 201) {
    throw new Error(
      `Expected 201 from POST /v1/scenarios, got ${String(createScenarioRes.status)}: ${await createScenarioRes.text()}`,
    )
  }
  const createdScenario = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
  const scenarioId = createdScenario.data?.scenario.scenarioId ?? ''

  const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      name: `Messages Stack Avatar ${idSuffix}`,
      personaPrompt: 'You are a stack e2e test avatar. Follow user instructions precisely.',
    }),
  })
  if (createAvatarRes.status !== 201) {
    throw new Error(
      `Expected 201 from POST /v1/scenarios/:scenarioId/avatars, got ${String(createAvatarRes.status)}: ${await createAvatarRes.text()}`,
    )
  }
  const createdAvatar = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
  const avatarId = createdAvatar.data?.avatar.avatarId ?? ''

  const startSessionRes = await fetch(`${APP_URL}/v1/conversations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ userId: `user_messages_stack_${idSuffix}`, scenarioId }),
  })
  if (startSessionRes.status !== 201) {
    throw new Error(
      `Expected 201 from POST /v1/conversations/start, got ${String(startSessionRes.status)}: ${await startSessionRes.text()}`,
    )
  }
  const startedSession = (await startSessionRes.json()) as ApiResponse<StartSessionResponse>
  const sessionId = startedSession.data?.session.sessionId ?? ''

  return { scenarioId, avatarId, sessionId }
}

// ── Null provider happy path ──────────────────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — null provider happy path', () => {
  let scenarioId = ''
  let avatarId = ''
  let sessionId = ''
  const userMessage = 'Hello from stack-e2e'

  it('creates scenario, avatar, and session via HTTP setup', async () => {
    const fixture = await createStackFixture()
    scenarioId = fixture.scenarioId
    avatarId = fixture.avatarId
    sessionId = fixture.sessionId
    expect(scenarioId.length).toBeGreaterThan(0)
    expect(avatarId.length).toBeGreaterThan(0)
    expect(sessionId.length).toBeGreaterThan(0)
  })

  it('sends a message and returns expected response shape', async () => {
    expect(sessionId.length).toBeGreaterThan(0)
    expect(avatarId.length).toBeGreaterThan(0)

    const res = await fetch(`${APP_URL}/v1/conversations/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId, message: { content: userMessage } }),
    })

    expect(res.status).toBe(200)

    const body = (await res.json()) as ApiResponse<SendMessageResponse>
    expect(body.error).toBeNull()
    expect(body.data?.session.sessionId).toBe(sessionId)
    expect(body.data?.userMessage.content).toBe(userMessage)
    expect(typeof body.data?.avatarMessage.content).toBe('string')
    expect((body.data?.avatarMessage.content.length ?? 0) > 0).toBe(true)
  })
})

// ── Real provider happy paths ─────────────────────────────────────────────────

const openaiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!openaiKey || isNullProvider)(
  'Stack E2E — POST /v1/conversations/:sessionId/messages — real OpenAI',
  () => {
    let avatarId = ''
    let sessionId = ''

    it('creates scenario, avatar, and session via HTTP setup', async () => {
      const fixture = await createStackFixture()
      avatarId = fixture.avatarId
      sessionId = fixture.sessionId
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it('sends a message and returns a non-empty LLM reply with token counts', async () => {
      expect(sessionId.length).toBeGreaterThan(0)
      expect(avatarId.length).toBeGreaterThan(0)

      const res = await fetch(`${APP_URL}/v1/conversations/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          avatarId,
          message: { content: 'Reply with exactly two words: "stack ok".' },
        }),
      })

      expect(res.status).toBe(200)

      const body = (await res.json()) as ApiResponse<SendMessageResponse>
      expect(body.error).toBeNull()
      expect(body.data?.avatarMessage.content).toBeTruthy()
      expect(body.data?.avatarMessage.metadata.inputTokens).toBeGreaterThan(0)
      expect(body.data?.avatarMessage.metadata.outputTokens).toBeGreaterThan(0)
      expect(body.data?.avatarMessage.metadata.latencyMs).toBeGreaterThan(0)
    })
  },
)

const anthropicKey = process.env['ANTHROPIC_API_KEY']

describe.skipIf(!anthropicKey || isNullProvider)(
  'Stack E2E — POST /v1/conversations/:sessionId/messages — real Anthropic',
  () => {
    let avatarId = ''
    let sessionId = ''

    it('creates scenario, avatar, and session via HTTP setup', async () => {
      const fixture = await createStackFixture()
      avatarId = fixture.avatarId
      sessionId = fixture.sessionId
      expect(sessionId.length).toBeGreaterThan(0)
    })

    it('sends a message and returns a non-empty LLM reply with token counts', async () => {
      expect(sessionId.length).toBeGreaterThan(0)
      expect(avatarId.length).toBeGreaterThan(0)

      const res = await fetch(`${APP_URL}/v1/conversations/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          avatarId,
          message: { content: 'Reply with exactly two words: "stack ok".' },
        }),
      })

      expect(res.status).toBe(200)

      const body = (await res.json()) as ApiResponse<SendMessageResponse>
      expect(body.error).toBeNull()
      expect(body.data?.avatarMessage.content).toBeTruthy()
      expect(body.data?.avatarMessage.metadata.inputTokens).toBeGreaterThan(0)
      expect(body.data?.avatarMessage.metadata.outputTokens).toBeGreaterThan(0)
      expect(body.data?.avatarMessage.metadata.latencyMs).toBeGreaterThan(0)
    })
  },
)
