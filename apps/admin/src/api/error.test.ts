import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { formatApiError } from './error'

describe('formatApiError', () => {
  it('formats an ApiError as "CODE: message"', () => {
    const error = new ApiError('NOT_FOUND', 'Scenario missing')

    expect(formatApiError(error, 'fallback')).toBe('NOT_FOUND: Scenario missing')
  })

  it('returns the fallback message for non-ApiError values', () => {
    expect(formatApiError(new Error('generic'), 'fallback')).toBe('fallback')
    expect(formatApiError('plain string', 'fallback')).toBe('fallback')
    expect(formatApiError(undefined, 'fallback')).toBe('fallback')
  })
})
