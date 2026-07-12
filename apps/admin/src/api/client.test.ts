import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, adminRequest } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adminRequest', () => {
  it('injects the api key header and returns unwrapped data on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await adminRequest<{ ok: boolean }>('GET', '/v1/scenarios')

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/v1/scenarios')
    expect((init.headers as Record<string, string>)['x-api-key']).toBeDefined()
  })

  it('omits the api key header for /health', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await adminRequest('GET', '/health')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['x-api-key']).toBeUndefined()
  })

  it('serializes the request body when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await adminRequest('POST', '/v1/scenarios', { name: 'Test' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ name: 'Test' }))
  })

  it('throws ApiError with the envelope error code/message on a domain error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(404, {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Scenario missing' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(adminRequest('GET', '/v1/scenarios/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Scenario missing',
    })
  })

  it('throws a NETWORK_ERROR ApiError when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))

    await expect(adminRequest('GET', '/v1/scenarios')).rejects.toBeInstanceOf(ApiError)
    await expect(adminRequest('GET', '/v1/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('throws a NETWORK_ERROR ApiError when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('bad json')),
      } as unknown as Response),
    )

    await expect(adminRequest('GET', '/v1/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('throws a NETWORK_ERROR ApiError when the envelope shape is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true })))

    await expect(adminRequest('GET', '/v1/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('throws a NETWORK_ERROR ApiError when data is missing despite a 200 status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: null, error: null })),
    )

    await expect(adminRequest('GET', '/v1/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })
})
