import { describe, expect, it } from 'vitest'

import type { ApiResponse, SendMessageResponse } from '@gami/shared'

import type { TestDefinition } from './contracts.js'
import { CoreApiClient, type FetchLike } from './core-api-client.js'
import { runEvaluation } from './evaluation.js'
import { SemanticJudgeClient } from './judge.js'

type RecordedCall = {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const session = {
  sessionId: 'session_scripted',
  userId: 'evaluation-user',
  scenarioId: 'murder-party-villa-miralac',
  status: 'active' as const,
  startedAt: '2026-07-29T00:00:00.000Z',
  lastActivityAt: '2026-07-29T00:00:00.000Z',
}

const conversation = {
  conversationId: 'conversation_scripted',
  sessionId: session.sessionId,
  avatarId: 'avatar_clara',
  status: 'active' as const,
  startedAt: '2026-07-29T00:00:00.000Z',
  lastActivityAt: '2026-07-29T00:00:00.000Z',
}

const avatar = {
  avatarId: 'avatar_clara',
  scenarioId: session.scenarioId,
  name: 'Clara Whitcombe',
  status: 'active' as const,
  personaPrompt: 'You are Clara Whitcombe.',
  computedTraits: null,
  config: {},
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
}

const definition: TestDefinition = {
  version: 1,
  name: 'Villa Miralac scripted ordering',
  scenarioId: session.scenarioId,
  initialAvatarName: 'Clara Whitcombe',
  model: 'declared-avatar',
  judgeModel: 'declared-judge',
  questions: [
    { question: 'What happened?', expectedResponse: 'Mention Lionel and the winter garden.' },
    { question: 'Who was present?', expectedResponse: 'Identify the relevant suspects.' },
    { question: 'What should I investigate next?', expectedResponse: 'Suggest a relevant clue.' },
  ],
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return { data, error: null }
}

function messageResponse(question: string): SendMessageResponse {
  return {
    session,
    conversation,
    userMessage: {
      messageId: `user-${question}`,
      conversationId: conversation.conversationId,
      role: 'user',
      content: question,
      createdAt: '2026-07-29T00:00:00.000Z',
    },
    avatarMessage: {
      messageId: `avatar-${question}`,
      conversationId: conversation.conversationId,
      role: 'avatar',
      content: `A relevant paraphrase for: ${question}`,
      createdAt: '2026-07-29T00:00:00.000Z',
      metadata: {
        model: 'observed-avatar',
        latencyMs: 12,
        inputTokens: 4,
        outputTokens: 6,
      },
    },
    debug: {
      requestId: `request-${question}`,
      model: 'observed-avatar',
      latencyMs: 12,
      inputTokens: 4,
      outputTokens: 6,
    },
  }
}

function recordCall(url: string, init: RequestInit | undefined): RecordedCall {
  const body =
    init?.body === undefined
      ? undefined
      : typeof init.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : (() => {
            throw new Error('The scripted fetch received a non-string request body.')
          })()
  return {
    url,
    method: init?.method ?? 'GET',
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body,
  }
}

function createScriptedFetch(events: string[]): {
  fetch: FetchLike
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []
  let messageNumber = 0

  const fetch: FetchLike = async (url, init) => {
    const call = recordCall(url, init)
    calls.push(call)
    const path = new URL(url).pathname

    if (path === `/v1/scenarios/${session.scenarioId}/avatars`) {
      return jsonResponse(okEnvelope({ avatars: [avatar] }))
    }
    if (path === '/v1/sessions') return jsonResponse(okEnvelope({ session }), 201)
    if (path === `/v1/sessions/${session.sessionId}/conversations`) {
      return jsonResponse(okEnvelope({ conversation }), 201)
    }
    if (path === `/v1/conversations/${conversation.conversationId}/messages`) {
      const body = call.body as { message: { content: string } }
      messageNumber += 1
      const currentMessageNumber = messageNumber
      events.push(`avatar-request:${String(currentMessageNumber)}`)
      return Promise.resolve(jsonResponse(okEnvelope(messageResponse(body.message.content)))).then(
        (response) => {
          events.push(`avatar-response:${String(currentMessageNumber)}`)
          return response
        },
      )
    }
    if (path === '/v1/exchange') {
      const body = call.body as { message: string }
      const evidence = JSON.parse(body.message) as { actualResponse: string }
      const questionNumber = evidence.actualResponse.includes('What happened?')
        ? '1'
        : evidence.actualResponse.includes('Who was present?')
          ? '2'
          : '3'
      events.push(`judge-request:${questionNumber}`)
      return Promise.resolve(
        jsonResponse(
          okEnvelope({
            requestId: 'judge-request',
            reply: JSON.stringify({
              passed: true,
              score: 4,
              reason: 'Accurate paraphrase with relevant additional context.',
              missingElements: [],
              contradictions: [],
            }),
            model: 'observed-judge',
            inputTokens: 10,
            outputTokens: 5,
            latencyMs: 8,
          }),
        ),
      ).then((response) => {
        events.push(`judge-response:${questionNumber}`)
        return response
      })
    }
    throw new Error(`Unexpected scripted request: ${path}`)
  }

  return { fetch, calls }
}

// eslint-disable-next-line max-lines-per-function
describe('composed scripted evaluation', () => {
  // eslint-disable-next-line max-lines-per-function
  it('runs three questions in order through one session and judges before the next question', async () => {
    const events: string[] = []
    const scripted = createScriptedFetch(events)
    const avatarClient = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'evaluation-key',
      timeoutMs: 1000,
      fetchImpl: scripted.fetch,
    })
    const judgeClient = new SemanticJudgeClient({
      baseUrl: 'https://core.example',
      apiKey: 'evaluation-key',
      timeoutMs: 1000,
      fetchImpl: scripted.fetch,
    })
    const snapshots: string[] = []

    const output = await runEvaluation({
      definition,
      userId: session.userId,
      avatarClient,
      judgeClient,
      startedAt: '2026-07-29T00:00:00.000Z',
      now: () => '2026-07-29T00:03:00.000Z',
      writeReport: (report) => {
        snapshots.push(JSON.stringify(report))
        return Promise.resolve()
      },
    })

    expect(events).toEqual([
      'avatar-request:1',
      'avatar-response:1',
      'judge-request:1',
      'judge-response:1',
      'avatar-request:2',
      'avatar-response:2',
      'judge-request:2',
      'judge-response:2',
      'avatar-request:3',
      'avatar-response:3',
      'judge-request:3',
      'judge-response:3',
    ])
    expect(output.report.status).toBe('completed')
    expect(output.report.questions.map((result) => result.status)).toEqual([
      'passed',
      'passed',
      'passed',
    ])
    expect(output.report.questions.map((result) => result.sessionId)).toEqual([
      session.sessionId,
      session.sessionId,
      session.sessionId,
    ])
    expect(output.report.questions.map((result) => result.conversationId)).toEqual([
      conversation.conversationId,
      conversation.conversationId,
      conversation.conversationId,
    ])
    expect(output.report.summary).toMatchObject({
      questions: 3,
      evaluated: 3,
      passed: 3,
      totalLatencyMs: 36,
      totalTokens: 30,
      totalJudgeLatencyMs: 24,
      totalJudgeTokens: 45,
      totalCostUsd: null,
    })
    expect(output.report.modelMismatches).toHaveLength(6)
    expect(snapshots).toHaveLength(5)

    expect(scripted.calls.every((call) => call.headers['x-api-key'] === 'evaluation-key')).toBe(
      true,
    )
    expect(scripted.calls.filter((call) => call.method === 'POST')).toHaveLength(8)
    expect(scripted.calls.filter((call) => call.url.endsWith('/messages'))).toHaveLength(3)
    expect(
      scripted.calls.filter((call) => call.url.endsWith('/messages')).map((call) => call.url),
    ).toEqual([
      `https://core.example/v1/conversations/${conversation.conversationId}/messages`,
      `https://core.example/v1/conversations/${conversation.conversationId}/messages`,
      `https://core.example/v1/conversations/${conversation.conversationId}/messages`,
    ])
    expect(scripted.calls[0]).toMatchObject({
      method: 'GET',
      url: `https://core.example/v1/scenarios/${session.scenarioId}/avatars`,
    })
    expect(scripted.calls.find((call) => call.url.endsWith('/v1/sessions'))).toMatchObject({
      method: 'POST',
      body: { userId: session.userId, scenarioId: session.scenarioId },
    })
    expect(
      scripted.calls.find((call) =>
        call.url.endsWith(`/sessions/${session.sessionId}/conversations`),
      ),
    ).toMatchObject({ method: 'POST', body: { avatarId: conversation.avatarId } })
    expect(
      scripted.calls.filter((call) => call.url.endsWith('/messages')).map((call) => call.body),
    ).toEqual(definition.questions.map((question) => ({ message: { content: question.question } })))
    const exchangeBody = scripted.calls.filter((call) => call.url.endsWith('/v1/exchange'))[0]?.body
    if (!isRecord(exchangeBody)) {
      throw new Error('Expected a structured judge request body.')
    }
    expect(exchangeBody['systemPrompt']).toContain('semantic evaluator')
    expect(scripted.calls.filter((call) => call.url.endsWith('/v1/exchange'))).toHaveLength(3)
  })
})
