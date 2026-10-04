import { describe, expect, it } from 'vitest'
import type { TurnCompletedEventPayload } from '@gami/shared'
import { turnFirstReplyMs, turnLatencySegments, turnVoiceReadyMs, turnWaitMs } from './turn-latency'

const base: TurnCompletedEventPayload = {
  conversationId: 'c',
  turnIndex: 1,
  avatarId: 'a',
  avatarLatencyMs: 1000,
  totalTurnLatencyMs: 1300,
  retrievalLatencyMs: 200,
  otherOverheadMs: 100,
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  model: 'm',
  hasGm: false,
  inputMode: 'text',
}

describe('turn latency', () => {
  it('splits a streamed voice turn into what the user waited for', () => {
    const turn = {
      ...base,
      inputMode: 'voice' as const,
      speechToTextLatencyMs: 400,
      avatarFirstTokenLatencyMs: 300,
    }

    expect(turnLatencySegments(turn).map((segment) => [segment.label, segment.ms])).toEqual([
      ['Speech-to-text', 400],
      ['Knowledge retrieval', 200],
      ['Avatar reply: first words (LLM)', 300],
      ['Avatar reply: rest of the text (LLM)', 700],
      ['Other', 100],
    ])
    expect(turnWaitMs(turn)).toBe(1700)
    expect(turnFirstReplyMs(turn)).toBe(1000)
  })

  it('keeps the Avatar call whole for non-streamed text turns', () => {
    expect(turnLatencySegments(base).map((segment) => segment.label)).toEqual([
      'Knowledge retrieval',
      'Avatar reply (LLM)',
      'Other',
    ])
    expect(turnFirstReplyMs(base)).toBeUndefined()
  })

  it('adds voice generation after the text when the reply was spoken', () => {
    const audio = {
      status: 'ok' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: {
        conversationId: 'c',
        messageId: 'm',
        provider: 'p',
        characterCount: 10,
        latencyMs: 800,
      },
    }

    expect(turnLatencySegments(base, audio).at(-1)).toMatchObject({
      label: 'Voice generation (text-to-speech)',
      ms: 800,
    })
    expect(turnVoiceReadyMs(base, audio)).toBe(2100)
    expect(turnVoiceReadyMs(base, null)).toBeUndefined()
  })
})
