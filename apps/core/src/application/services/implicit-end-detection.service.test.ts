import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMPLICIT_END_POLICY,
  detectImplicitEndReason,
} from './implicit-end-detection.service.js'

describe('detectImplicitEndReason', () => {
  it('returns auto_terminal_signal for explicit terminal markers', () => {
    const reason = detectImplicitEndReason({
      userMessage: 'Goodbye.',
      lastActivityAt: '2026-05-04T12:00:00.000Z',
      now: '2026-05-04T12:00:05.000Z',
      policy: DEFAULT_IMPLICIT_END_POLICY,
    })

    expect(reason).toBe('auto_terminal_signal')
  })

  it('returns inactivity_timeout when inactivity threshold is exceeded', () => {
    const reason = detectImplicitEndReason({
      userMessage: 'Still here',
      lastActivityAt: '2026-05-04T12:00:00.000Z',
      now: '2026-05-04T12:45:00.000Z',
      policy: {
        ...DEFAULT_IMPLICIT_END_POLICY,
        inactivityMs: 30 * 60 * 1000,
      },
    })

    expect(reason).toBe('inactivity_timeout')
  })

  it('returns null when policy is disabled', () => {
    const reason = detectImplicitEndReason({
      userMessage: 'bye',
      lastActivityAt: '2026-05-04T12:00:00.000Z',
      now: '2026-05-04T12:00:05.000Z',
      policy: {
        enabled: false,
        terminalSignals: ['bye'],
      },
    })

    expect(reason).toBeNull()
  })
})
