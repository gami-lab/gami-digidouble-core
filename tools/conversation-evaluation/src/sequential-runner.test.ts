import { describe, expect, it, vi } from 'vitest'

import type { ApiResponse, SendMessageResponse } from '@gami/shared'

import type { TestDefinition } from './contracts.js'
import { CoreApiClient, type FetchLike } from './core-api-client.js'
import { runSequentialConversation } from './sequential-runner.js'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return { data, error: null }
}

function errorEnvelope(code: string, message: string): ApiResponse<null> {
  return { data: null, error: { code: code as never, message } }
}

const definition: TestDefinition = {
  version: 1,
  name: 'Runner test',
  scenarioId: 'scenario_1',
  initialAvatarId: 'avatar_1',
  model: 'declared-model',
  questions: [
    { question: 'First question', expectedResponse: 'First criteria' },
    { question: 'Second question', expectedResponse: 'Second criteria' },
  ],
}

const session = {
  sessionId: 'session_1',
  userId: 'evaluation-user',
  scenarioId: 'scenario_1',
  status: 'active' as const,
  startedAt: '2026-07-29T00:00:00.000Z',
  lastActivityAt: '2026-07-29T00:00:00.000Z',
}

const conversation = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active' as const,
  startedAt: '2026-07-29T00:00:00.000Z',
  lastActivityAt: '2026-07-29T00:00:00.000Z',
}

const avatar = {
  avatarId: 'avatar_1',
  scenarioId: 'scenario_1',
  name: 'Clara',
  status: 'active' as const,
  personaPrompt: 'You are Clara.',
  computedTraits: null,
  config: {},
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
}

function messageResponse(content: string, model = 'observed-model'): SendMessageResponse {
  return {
    conversation,
    session,
    userMessage: {
      messageId: `user-${content}`,
      conversationId: conversation.conversationId,
      role: 'user',
      content,
      createdAt: '2026-07-29T00:00:00.000Z',
    },
    avatarMessage: {
      messageId: `avatar-${content}`,
      conversationId: conversation.conversationId,
      role: 'avatar',
      content: `Answer: ${content}`,
      createdAt: '2026-07-29T00:00:00.000Z',
      metadata: {
        model,
        latencyMs: 12,
        inputTokens: 4,
        outputTokens: 6,
      },
    },
    debug: {
      requestId: `request-${content}`,
      model,
      latencyMs: 12,
      inputTokens: 4,
      outputTokens: 6,
    },
  }
}

function createClient(fetchMock: FetchLike): CoreApiClient {
  return new CoreApiClient({
    baseUrl: 'https://core.example/',
    apiKey: 'test-key',
    timeoutMs: 1000,
    fetchImpl: fetchMock,
  })
}

function definitionWithAvatarName(name: string, questions = definition.questions): TestDefinition {
  return {
    version: definition.version,
    name: definition.name,
    scenarioId: definition.scenarioId,
    initialAvatarName: name,
    ...(definition.model !== undefined ? { model: definition.model } : {}),
    questions,
  }
}

// The deferred first response is intentional: it proves the second message is not requested
// until the first Avatar response has completed.
// eslint-disable-next-line max-lines-per-function
describe('runSequentialConversation', () => {
  it('sends the selected model when creating the session and Avatar messages', async () => {
    const firstQuestion = definition.questions[0]
    if (firstQuestion === undefined) throw new Error('Test definition has no first question.')
    const fetchMock = vi.fn<FetchLike>().mockImplementation((url) => {
      if (url.endsWith('/v1/sessions'))
        return Promise.resolve(jsonResponse(okEnvelope({ session })))
      if (url.endsWith('/v1/sessions/session_1/conversations')) {
        return Promise.resolve(jsonResponse(okEnvelope({ conversation }), 201))
      }
      return Promise.resolve(jsonResponse(okEnvelope(messageResponse('First question'))))
    })

    await runSequentialConversation(createClient(fetchMock), {
      definition: { ...definition, questions: [firstQuestion] },
      userId: 'evaluation-user',
      modelOverride: 'openai/gpt-5.6-luna-fast',
    })

    const sessionRequest = fetchMock.mock.calls[0]?.[1]
    const messageRequest = fetchMock.mock.calls[2]?.[1]
    if (typeof sessionRequest?.body !== 'string' || typeof messageRequest?.body !== 'string') {
      throw new Error('Expected JSON request bodies.')
    }
    expect(JSON.parse(sessionRequest.body)).toMatchObject({
      model: { provider: 'openai', model: 'gpt-5.6-luna', serviceTier: 'fast' },
    })
    expect(JSON.parse(messageRequest.body)).toMatchObject({
      model: { provider: 'openai', model: 'gpt-5.6-luna', serviceTier: 'fast' },
    })
  })

  it('uses one session and conversation and sends questions in strict order', async () => {
    const calls: string[] = []
    let resolveFirst: ((response: Response) => void) | undefined
    const fetchMock = vi.fn<FetchLike>().mockImplementation((url) => {
      calls.push(url)
      if (url.endsWith('/v1/sessions'))
        return Promise.resolve(jsonResponse(okEnvelope({ session })))
      if (url.endsWith('/v1/sessions/session_1/conversations')) {
        return Promise.resolve(jsonResponse(okEnvelope({ conversation }), 201))
      }
      if (
        url.endsWith('/messages') &&
        calls.filter((call) => call.endsWith('/messages')).length === 1
      ) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      }
      if (url.endsWith('/messages')) {
        return Promise.resolve(jsonResponse(okEnvelope(messageResponse('Second question'))))
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const executionPromise = runSequentialConversation(createClient(fetchMock), {
      definition,
      userId: 'evaluation-user',
    })
    await vi.waitFor(() => {
      expect(calls).toHaveLength(3)
    })
    expect(calls).toEqual([
      'https://core.example/v1/sessions',
      'https://core.example/v1/sessions/session_1/conversations',
      'https://core.example/v1/conversations/conversation_1/messages',
    ])
    expect(resolveFirst).toBeDefined()

    const firstResponseResolver = resolveFirst
    expect(firstResponseResolver).toBeDefined()
    firstResponseResolver?.(jsonResponse(okEnvelope(messageResponse('First question'))))
    const execution = await executionPromise
    expect(calls).toHaveLength(4)
    expect(execution.results.map((result) => result.question)).toEqual([
      'First question',
      'Second question',
    ])
    expect(execution.results.every((result) => result.status === 'completed')).toBe(true)
    expect(execution.results.map((result) => result.sessionId)).toEqual(['session_1', 'session_1'])
    expect(execution.results.map((result) => result.conversationId)).toEqual([
      'conversation_1',
      'conversation_1',
    ])
    expect(execution.results[0]?.metrics).toMatchObject({ totalTokens: 10, costUsd: null })
    expect(execution.modelMismatches).toEqual([
      { questionNumber: 1, declaredModel: 'declared-model', observedModel: 'observed-model' },
      { questionNumber: 2, declaredModel: 'declared-model', observedModel: 'observed-model' },
    ])
  })

  it('resolves a unique normalized Avatar name through the scenario Avatar endpoint', async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation((url) => {
      if (url.endsWith('/v1/scenarios/scenario_1/avatars')) {
        return Promise.resolve(
          jsonResponse(
            okEnvelope({
              avatars: [{ ...avatar, name: '  Clara  ' }],
            }),
          ),
        )
      }
      if (url.endsWith('/v1/sessions'))
        return Promise.resolve(jsonResponse(okEnvelope({ session })))
      if (url.endsWith('/v1/sessions/session_1/conversations')) {
        return Promise.resolve(jsonResponse(okEnvelope({ conversation }), 201))
      }
      return Promise.resolve(jsonResponse(okEnvelope(messageResponse('First question'))))
    })
    const firstQuestion = definition.questions[0]
    if (firstQuestion === undefined) throw new Error('Test definition has no first question.')
    const nameDefinition = definitionWithAvatarName('clara', [firstQuestion])

    const execution = await runSequentialConversation(createClient(fetchMock), {
      definition: nameDefinition,
      userId: 'evaluation-user',
    })
    expect(execution.avatarId).toBe('avatar_1')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://core.example/v1/scenarios/scenario_1/avatars',
    )
  })

  it('surfaces a not-found bootstrap failure without choosing an arbitrary Avatar', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        jsonResponse(
          okEnvelope({ avatars: [{ ...avatar, avatarId: 'other', name: 'Other Avatar' }] }),
        ),
      )
    const nameDefinition = definitionWithAvatarName('Missing Avatar')

    await expect(
      runSequentialConversation(createClient(fetchMock), {
        definition: nameDefinition,
        userId: 'evaluation-user',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an ambiguous normalized Avatar name', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        okEnvelope({
          avatars: [
            { ...avatar, name: 'Clara' },
            { ...avatar, avatarId: 'avatar_2', name: ' clara ' },
          ],
        }),
      ),
    )

    await expect(
      runSequentialConversation(createClient(fetchMock), {
        definition: definitionWithAvatarName('CLARA'),
        userId: 'evaluation-user',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retains completed results and records a message API error as a partial run', async () => {
    let messageNumber = 0
    const fetchMock = vi.fn<FetchLike>().mockImplementation((url) => {
      if (url.endsWith('/v1/sessions'))
        return Promise.resolve(jsonResponse(okEnvelope({ session })))
      if (url.endsWith('/v1/sessions/session_1/conversations')) {
        return Promise.resolve(jsonResponse(okEnvelope({ conversation }), 201))
      }
      messageNumber += 1
      if (messageNumber === 1) {
        return Promise.resolve(jsonResponse(okEnvelope(messageResponse('First question'))))
      }
      return Promise.resolve(
        jsonResponse(errorEnvelope('CONFLICT', 'Conversation is closed.'), 409),
      )
    })

    const execution = await runSequentialConversation(createClient(fetchMock), {
      definition: {
        ...definition,
        questions: [...definition.questions, { question: 'Third', expectedResponse: 'Third' }],
      },
      userId: 'evaluation-user',
    })
    expect(execution.status).toBe('api_error')
    expect(execution.results).toHaveLength(2)
    expect(execution.results[0]?.status).toBe('completed')
    expect(execution.results[1]).toMatchObject({
      questionNumber: 2,
      question: 'Second question',
      expectedResponse: 'Second criteria',
      actualResponse: null,
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      status: 'api_error',
      error: { kind: 'api_error', code: 'CONFLICT', status: 409 },
    })
    expect(messageNumber).toBe(2)
  })
})
