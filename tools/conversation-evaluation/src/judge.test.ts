import { describe, expect, it, vi } from 'vitest'

import type { ApiResponse, RawExchangeResponse } from '@gami/shared'

import { type FetchLike } from './core-api-client.js'
import {
  JudgeClientError,
  MAX_EXCHANGE_MESSAGE_LENGTH,
  parseJudgeResult,
  SemanticJudgeClient,
  serializeSemanticJudgeInput,
} from './judge.js'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function okEnvelope<T>(data: T): ApiResponse<T> {
  return { data, error: null }
}

function exchange(reply: string): RawExchangeResponse {
  return {
    requestId: 'judge-request',
    reply,
    model: 'observed-judge-model',
    inputTokens: 20,
    outputTokens: 10,
    latencyMs: 30,
  }
}

// eslint-disable-next-line max-lines-per-function
describe('semantic judge', () => {
  it('accepts paraphrases and preserves empty diagnostic arrays', () => {
    expect(
      parseJudgeResult(
        JSON.stringify({
          passed: true,
          score: 5,
          reason: 'The answer conveys the same meaning.',
          missingElements: [],
          contradictions: [],
        }),
      ),
    ).toEqual({
      passed: true,
      score: 5,
      reason: 'The answer conveys the same meaning.',
      missingElements: [],
      contradictions: [],
    })
  })

  it('accepts relevant additional information without requiring exact wording', () => {
    expect(
      parseJudgeResult(
        JSON.stringify({
          passed: true,
          score: 4,
          reason: 'The answer adds relevant context while preserving the required meaning.',
          missingElements: [],
          contradictions: [],
        }),
      ),
    ).toMatchObject({ passed: true, score: 4, missingElements: [], contradictions: [] })
  })

  it('represents missing criteria and contradictions as a valid quality failure', () => {
    expect(
      parseJudgeResult(
        JSON.stringify({
          passed: false,
          score: 2,
          reason: 'The answer omits the storm and contradicts the witness count.',
          missingElements: ['the storm'],
          contradictions: ['says two witnesses instead of one'],
        }),
      ),
    ).toMatchObject({ passed: false, score: 2 })
  })

  it('accepts only the deterministic fenced JSON form', () => {
    expect(
      parseJudgeResult(
        '```json\n{"passed":true,"score":4,"reason":"Relevant paraphrase.","missingElements":[],"contradictions":[]}\n```',
      ).passed,
    ).toBe(true)
    expect(() => parseJudgeResult('Here is the result: {"passed":true}')).toThrow(JudgeClientError)
  })

  it('rejects malformed or ambiguous output', () => {
    expect(() => parseJudgeResult(JSON.stringify({ passed: true }))).toThrow(/score/)
    expect(() =>
      parseJudgeResult(
        JSON.stringify({
          passed: true,
          score: 6,
          reason: 'Nope',
          missingElements: [],
          contradictions: [],
        }),
      ),
    ).toThrow(/1 to 5/)
    expect(() =>
      parseJudgeResult(
        JSON.stringify({
          passed: true,
          score: 4,
          reason: 'Okay',
          missingElements: [],
          contradictions: [],
          extra: 'ambiguous',
        }),
      ),
    ).toThrow(/unsupported fields/)
  })

  it('uses the authenticated raw exchange boundary and keeps judge model metadata separate', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        okEnvelope(
          exchange(
            JSON.stringify({
              passed: true,
              score: 4,
              reason: 'Semantically correct.',
              missingElements: [],
              contradictions: [],
            }),
          ),
        ),
      ),
    )
    const client = new SemanticJudgeClient({
      baseUrl: 'https://judge.example///',
      apiKey: 'judge-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(
      client.evaluate({
        question: 'What happened?',
        expectedResponse: 'Mention the storm.',
        actualResponse: 'The storm caused it.',
      }),
    ).resolves.toMatchObject({
      metrics: {
        model: 'observed-judge-model',
        latencyMs: 30,
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      },
      result: { passed: true },
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://judge.example/v1/exchange')
    expect(init?.headers).toMatchObject({ 'x-api-key': 'judge-key' })
    const rawBody = typeof init?.body === 'string' ? init.body : '{}'
    const body = JSON.parse(rawBody) as { message: string; systemPrompt: string }
    expect(JSON.parse(body.message)).toEqual({
      question: 'What happened?',
      expectedResponse: 'Mention the storm.',
      actualResponse: 'The storm caused it.',
    })
    expect(body.systemPrompt).toContain('semantic evaluator')
  })

  it('keeps a judge API error separate from a quality failure', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        jsonResponse(
          { data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid API key.' } },
          401,
        ),
      )
    const client = new SemanticJudgeClient({
      baseUrl: 'https://judge.example',
      apiKey: 'judge-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(
      client.evaluate({ question: 'Q', expectedResponse: 'E', actualResponse: 'A' }),
    ).rejects.toMatchObject({ kind: 'judge_error', code: 'UNAUTHORIZED', status: 401 })
  })

  it('rejects oversized serialized evidence before making a request', async () => {
    const fetchMock = vi.fn<FetchLike>()
    const client = new SemanticJudgeClient({
      baseUrl: 'https://judge.example',
      apiKey: 'judge-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })
    const input = {
      question: 'Q',
      expectedResponse: 'E',
      actualResponse: 'x'.repeat(MAX_EXCHANGE_MESSAGE_LENGTH),
    }
    expect(() => serializeSemanticJudgeInput(input)).toThrow(/body limit/)
    await expect(client.evaluate(input)).rejects.toMatchObject({ kind: 'judge_error' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
