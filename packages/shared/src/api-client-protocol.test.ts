import { describe, expect, it } from 'vitest'
import {
  ApiError,
  createApiError,
  formatApiError,
  isApiResponseEnvelope,
  normalizeApiPath,
  normalizeApiUrl,
  isAdminApiPath,
  resolveApiUrl,
} from './api-client-protocol.js'

describe('api client protocol helpers', () => {
  it('normalizes API URLs and paths without changing non-trailing content', () => {
    expect(normalizeApiUrl('https://example.test///')).toBe('https://example.test//')
    expect(normalizeApiPath('v1/scenarios')).toBe('/v1/scenarios')
    expect(normalizeApiPath('/v1/admin/scenarios')).toBe('/v1/admin/scenarios')
  })

  it('recognizes admin API paths', () => {
    expect(isAdminApiPath('/v1/admin/scenarios')).toBe(true)
    expect(isAdminApiPath('v1/admin/auth/me')).toBe(true)
    expect(isAdminApiPath('/v1/sessions')).toBe(false)
    expect(isAdminApiPath('/v1/administrator')).toBe(false)
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

  it('formats client errors and preserves consumer fallback messages', () => {
    expect(formatApiError(new ApiError('NOT_FOUND', 'Missing'), 'fallback')).toBe(
      'NOT_FOUND: Missing',
    )
    expect(formatApiError(new Error('generic'), 'fallback')).toBe('fallback')
  })
})

describe('resolveApiUrl', () => {
  it('resolves Core-relative paths against the API base and keeps absolute URLs', () => {
    expect(resolveApiUrl('/v1/media/media_1', 'https://api.example.com/')).toBe(
      'https://api.example.com/v1/media/media_1',
    )
    expect(resolveApiUrl('https://cdn.example.com/a.png', 'https://api.example.com')).toBe(
      'https://cdn.example.com/a.png',
    )
  })
})
