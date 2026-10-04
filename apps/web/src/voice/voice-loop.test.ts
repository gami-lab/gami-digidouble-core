import { describe, expect, it } from 'vitest'
import { getVoiceLoopPhase } from './voice-loop'

describe('getVoiceLoopPhase', () => {
  it.each([
    [false, 'idle', 'idle', 'off'],
    [true, 'idle', 'idle', 'listening'],
    [true, 'streaming', 'idle', 'waiting'],
    [true, 'idle', 'loading', 'speaking'],
    [true, 'idle', 'playing', 'speaking'],
    [true, 'idle', 'stopped', 'listening'],
    [true, 'idle', 'failed', 'listening'],
  ] as const)('enabled=%s send=%s audio=%s → %s', (enabled, send, audio, phase) => {
    expect(getVoiceLoopPhase(enabled, send, audio)).toBe(phase)
  })
})
