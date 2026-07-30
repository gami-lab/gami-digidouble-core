import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { ApiResponse, SendMessageResponse } from '@gami/shared'

import { CoreApiClient, type FetchLike } from './core-api-client.js'
import { runEvaluation } from './evaluation.js'
import type { TestDefinition } from './contracts.js'
import { SemanticJudgeClient } from './judge.js'
import { writeReportAtomically } from './report.js'

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
    {
      question: 'What happened?',
      expectedResponse: 'Mention the storm.',
      requiredFacts: ['the storm'],
      acceptedAlternatives: ['the storm caused it'],
      forbiddenClaims: ['there was no storm'],
    },
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

function judgeReply(passed: boolean, score = passed ? 5 : 2): string {
  return JSON.stringify({
    passed,
    score,
    reason: passed ? 'Accurate paraphrase.' : 'The essential element is missing.',
    missingElements: passed ? [] : ['the storm'],
    contradictions: [],
  })
}

function createClients(
  messageFailure = false,
  malformedJudge = false,
  judgePassed = true,
  judgeScore?: 1 | 2 | 3 | 4 | 5,
  malformedJudgeAttempts = malformedJudge ? Number.POSITIVE_INFINITY : 0,
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
  let judgeRequestCount = 0
  const judgeFetch = vi.fn<FetchLike>().mockImplementation(() => {
    judgeRequestCount += 1
    return Promise.resolve(
      jsonResponse(
        okEnvelope({
          requestId: 'judge-request',
          reply:
            judgeRequestCount <= malformedJudgeAttempts
              ? '{"passed":true}'
              : judgeReply(judgePassed, judgeScore ?? (judgePassed ? 5 : 2)),
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

// eslint-disable-next-line max-lines-per-function
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
    expect(output.report.questions[0]).toMatchObject({
      requiredFacts: ['the storm'],
      acceptedAlternatives: ['the storm caused it'],
      forbiddenClaims: ['there was no storm'],
    })
    const firstJudgeRequest = clients.judgeFetch.mock.calls[0]?.[1]
    const firstJudgeBody = JSON.parse(
      typeof firstJudgeRequest?.body === 'string' ? firstJudgeRequest.body : '{}',
    ) as { message?: string }
    expect(JSON.parse(firstJudgeBody.message ?? '{}')).toMatchObject({
      requiredFacts: ['the storm'],
      acceptedAlternatives: ['the storm caused it'],
      forbiddenClaims: ['there was no storm'],
    })
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
    const progress: string[] = []
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      onProgress: (message) => progress.push(message),
      writeReport: vi.fn().mockResolvedValue(undefined),
    })
    expect(output.report.status).toBe('judge_error')
    expect(output.report.summary.evaluated).toBe(0)
    expect(output.report.questions.every((question) => question.status === 'judge_error')).toBe(
      true,
    )
    expect(clients.judgeFetch).toHaveBeenCalledTimes(6)
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Question 1/2: judge attempt 1/3 failed'),
        expect.stringContaining('Question 1/2: judge failed after 3 attempts'),
      ]),
    )
  })

  it('retries a transient judge failure and then records the successful result', async () => {
    const clients = createClients(false, true, true, undefined, 2)
    const progress: string[] = []
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      onProgress: (message) => progress.push(message),
      writeReport: vi.fn().mockResolvedValue(undefined),
    })

    expect(output.report.status).toBe('completed')
    expect(output.report.questions.map((question) => question.status)).toEqual(['passed', 'passed'])
    expect(clients.judgeFetch).toHaveBeenCalledTimes(4)
    expect(progress).toEqual(
      expect.arrayContaining([expect.stringContaining('Question 1/2: judge attempt 2/3 failed')]),
    )
  })

  it('records a valid quality failure without classifying it as an infrastructure error', async () => {
    const clients = createClients(false, false, false)
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      writeReport: vi.fn().mockResolvedValue(undefined),
    })

    expect(output.report.status).toBe('completed')
    expect(output.report.questions.every((question) => question.status === 'failed')).toBe(true)
    expect(output.report.questions[0]).toMatchObject({
      judge: {
        passed: false,
        missingElements: ['the storm'],
      },
      judgeMetrics: {
        model: 'observed-judge',
        totalTokens: 15,
      },
      error: null,
    })
    expect(output.report.summary).toMatchObject({
      evaluated: 2,
      passed: 0,
      failed: 2,
      partial: 0,
      passRate: 0,
      totalJudgeLatencyMs: 16,
      totalJudgeTokens: 30,
    })
  })

  it('classifies score-three responses as partial quality outcomes', async () => {
    const clients = createClients(false, false, false, 3)
    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      writeReport: vi.fn().mockResolvedValue(undefined),
    })

    expect(output.report.status).toBe('completed')
    expect(output.report.questions.every((question) => question.status === 'partial')).toBe(true)
    expect(output.report.summary).toMatchObject({
      evaluated: 2,
      passed: 0,
      partial: 2,
      failed: 0,
      passRate: 0,
    })
  })

  it('leaves a valid real-file partial report when the caller aborts after a completed question', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-abort-'))
    const outputPath = join(directory, 'report.json')
    const interruption = new AbortController()
    const clients = createClients()

    const output = await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      signal: interruption.signal,
      outputPath,
      writeReport: async (report) => {
        await writeReportAtomically(outputPath, report)
        if (report.questions.length === 1) interruption.abort()
      },
    })

    const persisted = JSON.parse(await readFile(outputPath, 'utf8')) as typeof output.report
    expect(output.report.status).toBe('api_error')
    expect(persisted.questions.map((question) => question.status)).toEqual(['passed', 'api_error'])
    expect(persisted.questions[1]?.error).toMatchObject({
      kind: 'api_error',
      code: 'ABORTED',
      phase: 'avatar_message',
    })
    expect((await readdir(directory)).filter((entry) => entry.endsWith('.tmp'))).toEqual([])
  })

  it('reports progress and waits between questions for asynchronous runtime work', async () => {
    const clients = createClients()
    const progress: string[] = []
    const delays: number[] = []

    await runEvaluation({
      definition,
      userId: 'evaluation-user',
      avatarClient: clients.avatarClient,
      judgeClient: clients.judgeClient,
      onProgress: (message) => progress.push(message),
      interQuestionDelayMs: 5000,
      waitBetweenQuestions: (durationMs) => {
        delays.push(durationMs)
        return Promise.resolve()
      },
      writeReport: vi.fn().mockResolvedValue(undefined),
    })

    expect(delays).toEqual([5000])
    expect(progress).toEqual(
      expect.arrayContaining([
        'Starting evaluation: Evaluation run.',
        'Question 1/2: sending Avatar request.',
        'Question 1/2: judging Avatar response.',
        'Question 1/2: passed.',
        'Waiting 5 seconds for async runtime work before the next question.',
        'Question 2/2: sending Avatar request.',
      ]),
    )
  })
})
