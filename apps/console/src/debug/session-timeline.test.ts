import { describe, expect, it } from 'vitest'
import type { Message, SessionEventRecord, TurnCompletedEventPayload } from '@gami/shared'
import { backgroundLabel, buildSessionTimeline } from './session-timeline'

function message(id: string, role: Message['role'], createdAt: string): Message {
  return { messageId: id, conversationId: 'conv_1', role, content: id, createdAt }
}

function turnEvent(
  correlationId: string,
  createdAt: string,
  turnIndex: number,
): SessionEventRecord {
  const payload: TurnCompletedEventPayload = {
    conversationId: 'conv_1',
    turnIndex,
    avatarId: 'avatar_1',
    avatarLatencyMs: 900,
    totalTurnLatencyMs: 1200,
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    model: 'model',
    hasGm: true,
    inputMode: 'text',
  }
  return { type: 'turn_completed', correlationId, createdAt, payload }
}

function memoryEvent(
  type: 'memory_refresh_triggered' | 'memory_refresh_succeeded',
  correlationId: string,
  createdAt: string,
  trigger: 'post_turn' | 'conversation_closed',
): SessionEventRecord {
  return {
    type,
    correlationId,
    createdAt,
    payload: { sessionId: 's', conversationId: 'conv_1', avatarId: 'avatar_1', trigger },
  }
}

describe('buildSessionTimeline', () => {
  // eslint-disable-next-line complexity -- assertions read optional timeline entries through optional chaining
  it('attaches messages, the GM run, and memory work to the turn that caused them', () => {
    const timeline = buildSessionTimeline(
      [
        memoryEvent('memory_refresh_succeeded', 'corr_2', '2026-01-01T00:00:12.000Z', 'post_turn'),
        turnEvent('corr_1', '2026-01-01T00:00:02.000Z', 1),
        turnEvent('corr_2', '2026-01-01T00:00:10.000Z', 2),
        {
          type: 'gm_triggered',
          correlationId: 'corr_1',
          createdAt: '2026-01-01T00:00:03.000Z',
          payload: {
            triggerReason: 'post_turn',
            turnIndex: 1,
            interactionCount: 1,
            stateBefore: { progression: 'intro' },
            latencyMs: 500,
          },
        },
        memoryEvent('memory_refresh_triggered', 'corr_2', '2026-01-01T00:00:11.000Z', 'post_turn'),
      ],
      {
        conv_1: [
          message('u1', 'user', '2026-01-01T00:00:00.000Z'),
          message('a1', 'avatar', '2026-01-01T00:00:01.000Z'),
          message('u2', 'user', '2026-01-01T00:00:05.000Z'),
          message('a2', 'avatar', '2026-01-01T00:00:09.000Z'),
        ],
      },
    )

    expect(timeline.map((entry) => entry.id)).toEqual(['corr_1', 'corr_2'])
    const [first, second] = timeline
    expect(first?.kind === 'turn' && first.userMessage?.messageId).toBe('u1')
    expect(first?.kind === 'turn' && first.avatarMessage?.messageId).toBe('a1')
    expect(first?.gm?.status).toBe('ok')
    expect(second?.kind === 'turn' && second.avatarMessage?.messageId).toBe('a2')
    expect(second?.memory).toHaveLength(1)
    expect(second?.memory[0]?.status).toBe('ok')
  })

  it('leaves the reply empty for a turn whose messages are not loaded', () => {
    const [entry] = buildSessionTimeline([turnEvent('corr_1', '2026-01-01T00:00:02.000Z', 1)], {})
    expect(entry?.kind === 'turn' && entry.avatarMessage).toBeNull()
  })

  it('groups conversation-close memory work into one background entry', () => {
    const timeline = buildSessionTimeline(
      [
        memoryEvent(
          'memory_refresh_triggered',
          'req_a',
          '2026-01-01T00:01:00.000Z',
          'conversation_closed',
        ),
        memoryEvent(
          'memory_refresh_succeeded',
          'req_a',
          '2026-01-01T00:01:02.000Z',
          'conversation_closed',
        ),
        {
          type: 'episodic_memory_generation_succeeded',
          correlationId: 'req_b',
          createdAt: '2026-01-01T00:01:03.000Z',
          payload: { conversationId: 'conv_1' },
        },
        {
          type: 'episodic_memory_generation_failed',
          correlationId: 'req_c',
          createdAt: '2026-01-01T00:01:04.000Z',
          payload: { conversationId: 'conv_1', error: 'boom' },
        },
      ],
      {},
    )

    expect(timeline).toHaveLength(1)
    const [entry] = timeline
    expect(entry?.kind).toBe('background')
    expect(entry?.memory.map((run) => run.status)).toEqual(['ok'])
    expect(entry?.kind === 'background' && entry.consolidation.map((step) => step.status)).toEqual([
      'ok',
      'failed',
    ])
  })
})

describe('buildSessionTimeline audio', () => {
  it('attaches the spoken version of a reply to its turn by message id', () => {
    const [entry] = buildSessionTimeline(
      [
        turnEvent('corr_1', '2026-01-01T00:00:02.000Z', 1),
        {
          type: 'message_audio_synthesized',
          correlationId: 'req_audio',
          createdAt: '2026-01-01T00:00:04.000Z',
          payload: {
            conversationId: 'conv_1',
            messageId: 'a1',
            provider: 'gradium',
            characterCount: 120,
            latencyMs: 900,
          },
        },
      ],
      {
        conv_1: [
          message('u1', 'user', '2026-01-01T00:00:00.000Z'),
          message('a1', 'avatar', '2026-01-01T00:00:01.000Z'),
        ],
      },
    )

    expect(entry?.kind === 'turn' && entry.audio?.payload.latencyMs).toBe(900)
  })
})

describe('buildSessionTimeline media', () => {
  function mediaEvent(
    type: SessionEventRecord['type'],
    correlationId: string,
    createdAt: string,
    cueToReportMs?: number,
  ): SessionEventRecord {
    return {
      type,
      correlationId,
      createdAt,
      payload: {
        cueId: 'cue_1',
        assetId: 'media_1',
        origin: 'game_master',
        ...(cueToReportMs !== undefined ? { cueToReportMs } : {}),
      },
    }
  }

  it('attaches a GM cue to its turn and a switch cue to its own entry', () => {
    const timeline = buildSessionTimeline(
      [
        turnEvent('turn_1', '2026-10-19T10:00:01.000Z', 1),
        mediaEvent('media.cue_emitted', 'turn_1', '2026-10-19T10:00:03.000Z'),
        mediaEvent('media.playback_started', 'turn_1', '2026-10-19T10:00:04.000Z', 1000),
        mediaEvent('media.cue_emitted', 'cue_switch', '2026-10-19T10:01:00.000Z'),
      ],
      {},
    )

    expect(timeline[0]?.media.map((event) => event.type)).toEqual([
      'media.cue_emitted',
      'media.playback_started',
    ])
    expect(timeline[1]).toMatchObject({ kind: 'background', id: 'cue_switch' })
    expect(timeline[1]?.kind === 'background' && backgroundLabel(timeline[1])).toBe('Media cue')
  })
})
