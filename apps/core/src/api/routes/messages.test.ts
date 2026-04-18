import { describe, expect, it, vi } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { Config } from '../../config.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Message, Session } from '../../domain/conversation/session.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { LlmError, NullLlmAdapter } from '../../infrastructure/llm/index.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

type SendMessageRouteData = {
  session: Session
  userMessage: Message
  avatarMessage: Message
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess_1',
    userId: 'user_1',
    scenarioId: 'scn_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    endedAt: null,
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'ava_1',
    scenarioId: 'scn_1',
    name: 'Ava',
    slug: 'ava',
    status: 'active',
    personaPrompt: 'You are Ava, a helpful guide.',
    tone: 'friendly',
    ...overrides,
  }
}

function makeApp({
  llmAdapter,
  sessions = [makeSession()],
  avatars = [makeAvatar()],
  messages = [],
}: {
  llmAdapter?: ILlmAdapter
  sessions?: Session[]
  avatars?: AvatarConfig[]
  messages?: Message[]
} = {}) {
  return createServer(testConfig, {
    llmAdapter: llmAdapter ?? new NullLlmAdapter('Avatar reply', 'gpt-4o-mini'),
    observabilityAdapter: new NullObservabilityAdapter(),
    sessionRepository: new InMemorySessionRepository(sessions),
    avatarRepository: new InMemoryAvatarRepository(avatars),
    messageRepository: new InMemoryMessageRepository(messages),
  })
}

function hasMessageHistory(
  value: unknown,
): value is { messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  if (typeof value !== 'object' || value === null || !('messages' in value)) {
    return false
  }
  const candidate = value as { messages: unknown }
  return Array.isArray(candidate.messages)
}

describe('POST /v1/conversations/:sessionId/messages — auth and validation', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'wrong-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when avatarId is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when message.content is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: {} },
    })
    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when message.content is empty', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: '' } },
    })
    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /v1/conversations/:sessionId/messages — session and use-case behavior', () => {
  it('returns 200 with a valid envelope on happy path', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendMessageRouteData>>()
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()
    const data = body.data as SendMessageRouteData
    expect(data.session.sessionId).toBe('sess_1')
    expect(data.session.userId).toBe('user_1')
    expect(data.session.scenarioId).toBe('scn_1')
    expect(data.session.status).toBe('active')
    expect(data.userMessage.role).toBe('user')
    expect(data.userMessage.sessionId).toBe('sess_1')
    expect(data.userMessage.content).toBe('Hello avatar')
    expect(data.avatarMessage.role).toBe('avatar')
    expect(data.avatarMessage.sessionId).toBe('sess_1')
    expect(data.avatarMessage.metadata).toEqual({
      model: 'gpt-4o-mini',
      latencyMs: 5,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    })
    expect(typeof data.debug.requestId).toBe('string')
    expect(data.debug.model).toBe('gpt-4o-mini')
    expect(data.debug.latencyMs).toBe(5)
    expect(data.debug.inputTokens).toBe(10)
    expect(data.debug.outputTokens).toBe(20)
  })

  it('returns 404 when session is unknown', async () => {
    const response = await makeApp({ sessions: [] }).inject({
      method: 'POST',
      url: '/v1/conversations/missing/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns 409 when session is closed', async () => {
    const response = await makeApp({
      sessions: [makeSession({ status: 'closed', endedAt: '2026-04-18T10:05:00.000Z' })],
    }).inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(409)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('CONFLICT')
  })

  it('returns 502 when the LLM adapter throws LlmError', async () => {
    const failingLlm = {
      complete: vi.fn().mockRejectedValue(new LlmError('openai', 'Provider timeout', 504)),
    }
    const response = await makeApp({ llmAdapter: failingLlm }).inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(502)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('EXTERNAL_SERVICE_ERROR')
  })

  it('returns 500 on unexpected errors', async () => {
    const crashingLlm = {
      complete: vi.fn().mockRejectedValue(new Error('Unexpected crash')),
    }
    const response = await makeApp({ llmAdapter: crashingLlm }).inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Hello avatar' } },
    })
    expect(response.statusCode).toBe(500)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('INTERNAL_ERROR')
  })
})

describe('POST /v1/conversations/:sessionId/messages — manual smoke flow', () => {
  it('supports three sequential turns and builds history chronologically', async () => {
    const complete = vi.fn().mockResolvedValue({
      content: 'Avatar reply',
      model: 'smoke-model',
      inputTokens: 3,
      outputTokens: 4,
      latencyMs: 2,
    })
    const app = makeApp({ llmAdapter: { complete } })

    const first = await app.inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'First user turn' } },
    })
    const second = await app.inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Second user turn' } },
    })
    const third = await app.inject({
      method: 'POST',
      url: '/v1/conversations/sess_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { avatarId: 'ava_1', message: { content: 'Third user turn' } },
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(third.statusCode).toBe(200)
    expect(complete).toHaveBeenCalledTimes(3)
    const thirdRequest = complete.mock.calls[2]?.[0] as unknown
    expect(hasMessageHistory(thirdRequest)).toBe(true)
    if (!hasMessageHistory(thirdRequest)) {
      throw new Error('Expected third LLM call to include message history.')
    }
    expect(thirdRequest.messages).toEqual([
      { role: 'user', content: 'First user turn' },
      { role: 'assistant', content: 'Avatar reply' },
      { role: 'user', content: 'Second user turn' },
      { role: 'assistant', content: 'Avatar reply' },
      { role: 'user', content: 'Third user turn' },
    ])
  })
})
