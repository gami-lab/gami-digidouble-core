import { describe, expect, it } from 'vitest'
import {
  ApiError,
  createApiError,
  isApiResponseEnvelope,
  normalizeApiPath,
  normalizeApiUrl,
  shouldInjectApiKey,
} from './api-client-protocol.js'

describe('api client protocol helpers', () => {
  it('normalizes API URLs and paths without changing non-trailing content', () => {
    expect(normalizeApiUrl('https://example.test///')).toBe('https://example.test//')
    expect(normalizeApiPath('v1/scenarios')).toBe('/v1/scenarios')
    expect(normalizeApiPath('/v1/scenarios')).toBe('/v1/scenarios')
  })

  it('only omits authentication for the health path', () => {
    expect(shouldInjectApiKey('/health')).toBe(false)
    expect(shouldInjectApiKey('health/')).toBe(true)
    expect(shouldInjectApiKey('/v1/health')).toBe(true)
  })

  it('guards success and error envelopes', () => {
    expect(isApiResponseEnvelope<{ ok: boolean }>({ data: { ok: true }, error: null })).toBe(true)
    expect(
      isApiResponseEnvelope({ data: null, error: { code: 'NOT_FOUND', message: 'Missing' } }),
    ).toBe(true)
    expect(isApiResponseEnvelope({ data: null, error: null })).toBe(false)
    expect(isApiResponseEnvelope({ data: {}, error: { code: 'NOT_FOUND' } })).toBe(false)
  })

  it('preserves the shared error fields in the client error runtime shape', () => {
    const error = createApiError({ code: 'NOT_FOUND', message: 'Missing', details: { id: 'a' } })
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      name: 'ApiError',
      code: 'NOT_FOUND',
      message: 'Missing',
      details: { id: 'a' },
    })
  })
})
