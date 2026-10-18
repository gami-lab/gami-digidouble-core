import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, coreRequest, onSignedOut } from './client'

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

describe('coreRequest', () => {
  it('normalizes the API URL and returns unwrapped data on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(coreRequest<{ ok: boolean }>('GET', '/v1/admin/scenarios')).resolves.toEqual({
      ok: true,
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/v1/admin/scenarios')
    expect(init.credentials).toBe('include')
    expect(new Headers(init.headers).get('x-api-key')).toBeNull()
  })

  it('sends the player API key on public routes only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await coreRequest('GET', '/v1/sessions/session_1/conversations')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('x-api-key')).toEqual(expect.any(String))
  })

  it('reports a signed-out admin session when an admin route answers 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, { data: null, error: { code: 'UNAUTHORIZED', message: 'No' } }),
        ),
    )
    const listener = vi.fn()
    const unsubscribe = onSignedOut(listener)

    await expect(coreRequest('GET', '/v1/admin/scenarios')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('omits the API key only for the health path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await coreRequest('GET', '/health')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('x-api-key')).toBeNull()
  })
})

describe('coreRequest request and response contract', () => {
  it('serializes request bodies and preserves the JSON request contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { data: { id: 'scenario_1' }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await coreRequest('POST', '/v1/admin/scenarios', { name: 'Test' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Test' }))
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('omits the JSON content type for bodyless actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await coreRequest('POST', '/v1/admin/sessions/session_1/gm/replay')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('Content-Type')).toBeNull()
  })

  it('maps API errors, malformed responses, and unsuccessful envelopes to client errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(404, { data: null, error: { code: 'NOT_FOUND', message: 'Missing' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { unexpected: true }))
      .mockResolvedValueOnce(jsonResponse(502, { data: { ok: true }, error: null }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid JSON')),
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(coreRequest('GET', '/v1/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Missing',
    })
    await expect(coreRequest('GET', '/v1/malformed')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid API response envelope from /v1/malformed',
    })
    await expect(coreRequest('GET', '/v1/unavailable')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Request failed with status 502',
    })
    await expect(coreRequest('GET', '/v1/invalid-json')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid JSON response from /v1/invalid-json',
    })
  })

  it('maps transport and invalid-envelope failures to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    await expect(coreRequest('GET', '/v1/admin/scenarios')).rejects.toBeInstanceOf(ApiError)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: null, error: null })),
    )
    await expect(coreRequest('GET', '/v1/admin/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid API response envelope from /v1/admin/scenarios',
    })
  })
})
