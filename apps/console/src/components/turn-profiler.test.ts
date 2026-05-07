import { describe, expect, it } from 'vitest'
import type { SessionEventRecord, TurnMetrics } from '@gami/shared'
import {
  applyTurnProfilerFilter,
  buildTurnProfilerRows,
  describeTurnLatency,
  describeTurnTokens,
} from './turn-profiler'

function makeTurns(): TurnMetrics[] {
  return [
    {
      turnIndex: 1,
      correlationId: 'corr_1',
      avatarLatencyMs: 120,
      totalTurnLatencyMs: 170,
      overheadMs: 20,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      model: 'model-a',
      hasGm: true,
      gmLatencyMs: 30,
      gmInputTokens: 5,
      gmOutputTokens: 7,
    },
    {
      turnIndex: 2,
      correlationId: 'corr_2',
      avatarLatencyMs: 90,
      totalTurnLatencyMs: 100,
      overheadMs: 10,
      inputTokens: 9,
      outputTokens: 11,
      totalTokens: 20,
      model: 'model-a',
      hasGm: false,
    },
  ]
}

function makeEvents(): SessionEventRecord[] {
  return [
    {
      type: 'turn_completed',
      correlationId: 'corr_1',
      createdAt: '2026-05-07T10:00:00.000Z',
      payload: {
        conversationId: 'conversation_1',
        turnIndex: 1,
        avatarId: 'avatar_1',
        avatarLatencyMs: 120,
        totalTurnLatencyMs: 170,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        model: 'model-a',
        hasGm: true,
      },
    },
  ]
}

describe('turn-profiler', () => {
  it('builds rows and aligns conversation id from event timeline when available', () => {
    const rows = buildTurnProfilerRows(makeTurns(), makeEvents())

    expect(rows).toHaveLength(2)
    expect(rows[0]?.conversationId).toBe('conversation_1')
    expect(rows[1]?.conversationId).toBeNull()
  })

  it('filters gm turns and sorts by slowest or latest', () => {
    const rows = buildTurnProfilerRows(makeTurns(), makeEvents())

    const gmOnly = applyTurnProfilerFilter(rows, {
      gmOnly: true,
      sort: 'slowest-total',
      limit: 20,
    })
    expect(gmOnly).toHaveLength(1)
    expect(gmOnly[0]?.correlationId).toBe('corr_1')

    const latest = applyTurnProfilerFilter(rows, {
      gmOnly: false,
      sort: 'latest-turn',
      limit: 20,
    })
    expect(latest[0]?.turnIndex).toBe(2)
  })

  it('formats latency and token strings with optional GM fields safely', () => {
    const rows = buildTurnProfilerRows(makeTurns(), makeEvents())
    const first = rows[0]
    const second = rows[1]

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) return
    expect(describeTurnLatency(first)).toContain('gm 30ms')
    expect(describeTurnLatency(second)).toContain('gm -')
    expect(describeTurnTokens(first)).toContain('gm in 5 / out 7')
    expect(describeTurnTokens(second)).toContain('tokens 20 (in 9 / out 11)')
  })
})
