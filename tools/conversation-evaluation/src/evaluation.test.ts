import { describe, expect, it, vi } from 'vitest'

import type { ApiResponse, SendMessageResponse } from '@gami/shared'

import { CoreApiClient, type FetchLike } from './core-api-client.js'
import { runEvaluation } from './evaluation.js'
import type { TestDefinition } from './contracts.js'
import { SemanticJudgeClient } from './judge.js'

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

const definition: TestDefinition = {
  version: 1,
  name: 'Evaluation run',
  scenarioId: 'scenario_1',
  initialAvatarId: 'avatar_1',
  model: 'declared-avatar',
  judgeModel: 'declared-judge',
  questions: [
    { question: 'What happened?', expectedResponse: 'Mention the storm.' },
    { question: 'Who was there?', expectedResponse: 'Name Clara.' },
  ],
}

function messageResponse(content: string): SendMessageResponse {
  return {
    session,
    conversation,
    userMessage: {
      messageId: `user-${content}`,
      conversationId: 'conversation_1',
      role: 'user',
      content,
      createdAt: '2026-07-29T00:00:00.000Z',
    },
    avatarMessage: {
      messageId: `avatar-${content}`,
      conversationId: 'conversation_1',
      role: 'avatar',
      content: `Paraphrase ${content}`,
      createdAt: '2026-07-29T00:00:00.000Z',
      metadata: {
        model: 'observed-avatar',
        latencyMs: 12,
        inputTokens: 4,
        outputTokens: 6,
      },
    },
    debug: {
      requestId: `request-${content}`,
      model: 'observed-avatar',
      latencyMs: 12,
      inputTokens: 4,
      outputTokens: 6,
    },
  }
}

function judgeReply(passed: boolean): string {
  return JSON.stringify({
    passed,
    score: passed ? 5 : 2,
    reason: passed ? 'Accurate paraphrase.' : 'The essential element is missing.',
    missingElements: passed ? [] : ['the storm'],
    contradictions: [],
  })
}

function createClients(
  messageFailure = false,
  malformedJudge = false,
): {
  avatarClient: CoreApiClient
  judgeClient: SemanticJudgeClient
  judgeFetch: ReturnType<typeof vi.fn<FetchLike>>
} {
  let messageCount = 0
  const avatarFetch = vi.fn<FetchLike>().mockImplementation((url) => {
    if (url.endsWith('/v1/sessions')) return Promise.resolve(jsonResponse(okEnvelope({ session })))
    if (url.endsWith('/v1/sessions/session_1/conversations')) {
      return Promise.resolve(jsonResponse(okEnvelope({ conversation }), 201))
    }
    messageCount += 1
    if (messageFailure && messageCount === 2) {
      return Promise.resolve(
        jsonResponse(errorEnvelope('CONFLICT', 'Conversation is closed.'), 409),
      )
    }
    return Promise.resolve(jsonResponse(okEnvelope(messageResponse(`q${String(messageCount)}`))))
  })
  const judgeFetch = vi.fn<FetchLike>().mockImplementation(() => {
    return Promise.resolve(
      jsonResponse(
        okEnvelope({
          requestId: 'judge-request',
          reply: malformedJudge ? '{"passed":true}' : judgeReply(true),
          model: 'observed-judge',
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 8,
        }),
      ),
    )
  })
  return {
    avatarClient: new CoreApiClient({
      baseUrl: 'https://avatar.example',
      apiKey: 'key',
      timeoutMs: 1000,
      fetchImpl: avatarFetch,
    }),
    judgeClient: new SemanticJudgeClient({
      baseUrl: 'https://judge.example',
      apiKey: 'key',
      timeoutMs: 1000,
      fetchImpl: judgeFetch,
    }),
    judgeFetch,
  }
}

describe('runEvaluation', () => {
  it('judges ordered responses, preserves mismatches, and writes incremental snapshots', async () => {
    const clients = createClients()
    const snapshots: string[] = []
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      startedAt: '2026-07-29T00:00:00.000Z',
      now: () => '2026-07-29T00:01:00.000Z',
      writeReport: (report) => {
        snapshots.push(JSON.stringify(report))
        return Promise.resolve()
      },
    })
    expect(output.report.status).toBe('completed')
    expect(output.report.questions.map((question) => question.status)).toEqual(['passed', 'passed'])
    expect(output.report.summary.passRate).toBe(1)
    expect(output.report.summary.totalCostUsd).toBeNull()
    expect(output.report.modelMismatches).toEqual([
      {
        role: 'avatar',
        questionNumber: 1,
        declaredModel: 'declared-avatar',
        observedModel: 'observed-avatar',
      },
      {
        role: 'judge',
        questionNumber: 1,
        declaredModel: 'declared-judge',
        observedModel: 'observed-judge',
      },
      {
        role: 'avatar',
        questionNumber: 2,
        declaredModel: 'declared-avatar',
        observedModel: 'observed-avatar',
      },
      {
        role: 'judge',
        questionNumber: 2,
        declaredModel: 'declared-judge',
        observedModel: 'observed-judge',
      },
    ])
    expect(snapshots).toHaveLength(4)
    const firstSnapshot = JSON.parse(snapshots[1] ?? '{}') as { questions?: unknown[] }
    expect(firstSnapshot.questions).toHaveLength(1)
  })

  it('keeps Avatar API errors distinct and leaves a valid partial report', async () => {
    const clients = createClients(true)
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      writeReport: vi.fn().mockResolvedValue(undefined),
    })
    expect(output.report.status).toBe('api_error')
    expect(output.report.questions).toHaveLength(2)
    expect(output.report.questions[0]?.status).toBe('passed')
    expect(output.report.questions[1]).toMatchObject({
      status: 'api_error',
      error: { kind: 'api_error' },
    })
    expect(clients.judgeFetch).toHaveBeenCalledTimes(1)
  })

  it('classifies malformed judge output separately from Avatar quality failure', async () => {
    const clients = createClients(false, true)
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      writeReport: vi.fn().mockResolvedValue(undefined),
    })
    expect(output.report.status).toBe('judge_error')
    expect(output.report.summary.evaluated).toBe(0)
    expect(output.report.questions.every((question) => question.status === 'judge_error')).toBe(
      true,
    )
  })
})
