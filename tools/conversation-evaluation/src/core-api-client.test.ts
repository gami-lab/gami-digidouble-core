import { describe, expect, it, vi } from 'vitest'

import type { ApiResponse } from '@gami/shared'

import { CoreApiClient, CoreApiError, type FetchLike } from './core-api-client.js'

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

function pendingFetch(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new Error('aborted'))
    })
  })
}

const sessionResponse = {
  session: {
    sessionId: 'session_1',
    userId: 'evaluation-user',
    scenarioId: 'scenario_1',
    status: 'active' as const,
    startedAt: '2026-07-29T00:00:00.000Z',
    lastActivityAt: '2026-07-29T00:00:00.000Z',
  },
}

// eslint-disable-next-line max-lines-per-function
describe('CoreApiClient', () => {
  it('normalizes the base URL, sends the API key, and decodes the standard envelope', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse(okEnvelope(sessionResponse), 201))
    const client = new CoreApiClient({
      baseUrl: 'https://core.example///',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(
      client.createSession({ userId: 'evaluation-user', scenarioId: 'scenario_1' }),
    ).resolves.toEqual(sessionResponse)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://core.example/v1/sessions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': 'test-key',
    })
    expect(init?.body).toBe(JSON.stringify({ userId: 'evaluation-user', scenarioId: 'scenario_1' }))
  })

  it('lists session events through the runtime usage contract', async () => {
    const events = [
      {
        type: 'gm_triggered',
        correlationId: 'corr_1',
        createdAt: '2026-07-30T00:00:00.000Z',
        payload: { inputTokens: 10, outputTokens: 5 },
      },
    ]
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse(okEnvelope({ events }), 200))
    const client = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(client.listSessionEvents('session/1')).resolves.toEqual({ events })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://core.example/v1/admin/sessions/session%2F1/events?limit=200',
    )
  })

  it('surfaces bounded envelope errors with status and code without exposing details', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse(
        {
          ...errorEnvelope('NOT_FOUND', `missing ${'x'.repeat(700)}\nsecret prompt`),
          error: {
            code: 'NOT_FOUND',
            message: `missing ${'x'.repeat(700)}\nsecret prompt`,
            details: { apiKey: 'do-not-expose' },
          },
        },
        404,
      ),
    )
    const client = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    const error = await client
      .createSession({ userId: 'user', scenarioId: 'missing' })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CoreApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', kind: 'api_error' })
    expect((error as CoreApiError).message.length).toBeLessThanOrEqual(500)
    expect((error as CoreApiError).message).not.toContain('do-not-expose')
  })

  it('rejects malformed successful bodies at the endpoint contract boundary', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(okEnvelope({ session: {} })))
      .mockResolvedValueOnce(jsonResponse(okEnvelope({})))
    const client = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(
      client.createSession({ userId: 'user', scenarioId: 'scenario_1' }),
    ).rejects.toMatchObject({
      kind: 'contract_error',
      code: 'INVALID_RESPONSE',
      phase: 'session_bootstrap',
    })
    await expect(client.sendMessage('conversation_1', 'Question')).rejects.toMatchObject({
      kind: 'contract_error',
      code: 'INVALID_RESPONSE',
      phase: 'avatar_message',
    })
  })

  it('preserves authentication failures as API errors', async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse(errorEnvelope('UNAUTHORIZED', 'Invalid API key.'), 401))
    const client = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })

    await expect(
      client.createSession({ userId: 'user', scenarioId: 'scenario_1' }),
    ).rejects.toMatchObject({
      kind: 'api_error',
      code: 'UNAUTHORIZED',
      status: 401,
    })
  })

  it('aborts a request when the configured timeout expires', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn<FetchLike>().mockImplementation(pendingFetch)
      const client = new CoreApiClient({
        baseUrl: 'https://core.example',
        apiKey: 'test-key',
        timeoutMs: 25,
        fetchImpl: fetchMock,
      })

      const request = client.createSession({ userId: 'user', scenarioId: 'scenario_1' })
      const timeoutExpectation = expect(request).rejects.toMatchObject({
        code: 'TIMEOUT',
        status: null,
      })
      await vi.advanceTimersByTimeAsync(25)
      await timeoutExpectation
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('supports caller-provided abort signals', async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(pendingFetch)
    const client = new CoreApiClient({
      baseUrl: 'https://core.example',
      apiKey: 'test-key',
      timeoutMs: 1000,
      fetchImpl: fetchMock,
    })
    const controller = new AbortController()
    const request = client.createSession(
      { userId: 'user', scenarioId: 'scenario_1' },
      { signal: controller.signal },
    )
    controller.abort()

    await expect(request).rejects.toMatchObject({ code: 'ABORTED', status: null })
  })
})
