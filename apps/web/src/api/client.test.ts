import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, webRequest } from './client'

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

describe('webRequest', () => {
  it('normalizes the API URL and returns unwrapped data on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(webRequest<{ ok: boolean }>('GET', '/v1/scenarios')).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/v1/scenarios')
    expect(new Headers(init.headers).get('x-api-key')).toEqual(expect.any(String))
  })

  it('omits the API key only for the health path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await webRequest('GET', '/health')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('x-api-key')).toBeNull()
  })

  it('serializes request bodies and preserves the browser JSON request contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { id: 'user_1' }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await webRequest('PUT', '/v1/users/user_1/persona', { displayName: 'Nora' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ displayName: 'Nora' }))
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('keeps JSON content type for bodyless actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { ok: true }, error: null }))
    vi.stubGlobal('fetch', fetchMock)

    await webRequest('POST', '/v1/sessions/session_1/reset')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
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

    await expect(webRequest('GET', '/v1/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Missing',
    })
    await expect(webRequest('GET', '/v1/malformed')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid API response envelope from /v1/malformed',
    })
    await expect(webRequest('GET', '/v1/unavailable')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Request failed with status 502',
    })
    await expect(webRequest('GET', '/v1/invalid-json')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid JSON response from /v1/invalid-json',
    })
  })

  it('maps transport and invalid-envelope failures to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    await expect(webRequest('GET', '/v1/scenarios')).rejects.toBeInstanceOf(ApiError)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: null, error: null })),
    )
    await expect(webRequest('GET', '/v1/scenarios')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Invalid API response envelope from /v1/scenarios',
    })
  })
})
