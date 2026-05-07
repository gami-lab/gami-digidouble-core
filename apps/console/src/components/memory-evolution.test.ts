import { describe, expect, it } from 'vitest'
import type { SessionEventRecord, SessionMemoryLayers } from '@gami/shared'
import {
  buildMemorySnapshot,
  computeMemoryDelta,
  pushMemorySnapshotHistory,
} from './memory-evolution'

function makeLayers(overrides?: Partial<SessionMemoryLayers>): SessionMemoryLayers {
  return {
    sessionId: 'session_1',
    shortTerm: {
      exchangeCount: 2,
      recentExchanges: [{ user: 'u1', avatar: 'a1' }],
    },
    working: {
      session: {
        summary: 'session summary',
        updatedAt: '2026-05-07T10:00:00.000Z',
      },
      avatars: [
        { avatarId: 'avatar_1', summary: 'avatar summary', updatedAt: '2026-05-07T10:00:00.000Z' },
      ],
    },
    longTerm: {
      facts: [
        {
          category: 'preference',
          key: 'tone',
          value: 'concise',
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
      ],
    },
    ...overrides,
  }
}

function makeTurnEvent(turnIndex: number): SessionEventRecord {
  return {
    type: 'turn_completed',
    correlationId: `corr_${String(turnIndex)}`,
    createdAt: '2026-05-07T10:00:00.000Z',
    payload: {
      conversationId: 'conversation_1',
      turnIndex,
      avatarId: 'avatar_1',
      avatarLatencyMs: 100,
      totalTurnLatencyMs: 120,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      model: 'test-model',
      hasGm: false,
    },
  }
}

describe('memory-evolution', () => {
  it('builds snapshot with latest turn marker from events', () => {
    const snapshot = buildMemorySnapshot(makeLayers(), [makeTurnEvent(2), makeTurnEvent(1)])

    expect(snapshot.turnIndex).toBe(2)
    expect(snapshot.conversationId).toBe('conversation_1')
  })

  it('computes bounded deltas across memory layers', () => {
    const previous = {
      snapshotId: 's1',
      capturedAt: '2026-05-07T10:00:00.000Z',
      turnIndex: 1,
      conversationId: 'conversation_1',
      layers: makeLayers(),
    }

    const current = {
      snapshotId: 's2',
      capturedAt: '2026-05-07T10:01:00.000Z',
      turnIndex: 2,
      conversationId: 'conversation_1',
      layers: makeLayers({
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [{ user: 'u2', avatar: 'a2' }],
        },
        working: {
          session: {
            summary: 'session summary updated',
            updatedAt: '2026-05-07T10:01:00.000Z',
          },
          avatars: [
            {
              avatarId: 'avatar_1',
              summary: 'avatar summary updated',
              updatedAt: '2026-05-07T10:01:00.000Z',
            },
          ],
        },
        longTerm: {
          facts: [
            {
              category: 'preference',
              key: 'tone',
              value: 'direct',
              updatedAt: '2026-05-07T10:01:00.000Z',
            },
            {
              category: 'goal',
              key: 'objective',
              value: 'improve memory',
              updatedAt: '2026-05-07T10:01:00.000Z',
            },
          ],
        },
      }),
    }

    const delta = computeMemoryDelta(previous, current)

    expect(delta.shortTerm.added).toHaveLength(1)
    expect(delta.shortTerm.removed).toHaveLength(1)
    expect(delta.working.sessionChanged).toBe(true)
    expect(delta.working.avatarChanged).toHaveLength(1)
    expect(delta.longTerm.added).toHaveLength(1)
    expect(delta.longTerm.changed).toHaveLength(1)
  })

  it('drops equivalent snapshots and keeps history bounded', () => {
    const one = buildMemorySnapshot(makeLayers(), [makeTurnEvent(1)])
    const two = buildMemorySnapshot(makeLayers(), [makeTurnEvent(1)])

    const history = pushMemorySnapshotHistory([], one)
    const deduped = pushMemorySnapshotHistory(history, two)

    expect(deduped).toHaveLength(1)
  })
})
