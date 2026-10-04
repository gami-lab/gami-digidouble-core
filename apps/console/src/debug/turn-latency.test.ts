import { describe, expect, it } from 'vitest'
import type { TurnCompletedEventPayload } from '@gami/shared'
import { turnFirstReplyMs, turnLatencySegments, turnWaitMs } from './turn-latency'

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
      ['Retrieval', 200],
      ['LLM to first token', 300],
      ['LLM generation', 700],
      ['Other', 100],
    ])
    expect(turnWaitMs(turn)).toBe(1700)
    expect(turnFirstReplyMs(turn)).toBe(1000)
  })

  it('keeps the Avatar call whole for non-streamed text turns', () => {
    expect(turnLatencySegments(base).map((segment) => segment.label)).toEqual([
      'Retrieval',
      'Avatar LLM',
      'Other',
    ])
    expect(turnFirstReplyMs(base)).toBeUndefined()
  })
})
