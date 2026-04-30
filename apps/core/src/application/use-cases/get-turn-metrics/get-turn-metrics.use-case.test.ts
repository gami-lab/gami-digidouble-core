import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import { GetTurnMetricsUseCase } from './get-turn-metrics.use-case.js'

const findBySessionIdMock = vi.fn<IEventLogRepository['findBySessionId']>()

function createUseCase(events: StoredEvent[]): GetTurnMetricsUseCase {
  const eventLogRepository: IEventLogRepository = {
    append: vi.fn(),
    findBySessionId: findBySessionIdMock.mockResolvedValue(events),
  }
  return new GetTurnMetricsUseCase(eventLogRepository)
}

function makeTurnCompletedEvent(params: {
  correlationId: string
  turnIndex: number
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model?: string
}): StoredEvent {
  return {
    sessionId: 'session_1',
    type: 'turn_completed',
    severity: 'info',
    correlationId: params.correlationId,
    payload: {
      conversationId: 'conversation_1',
      turnIndex: params.turnIndex,
      avatarId: 'avatar_1',
      avatarLatencyMs: params.avatarLatencyMs,
      totalTurnLatencyMs: params.totalTurnLatencyMs,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.totalTokens,
      model: params.model ?? 'model-x',
      hasGm: true,
    },
    createdAt: '2026-04-30T10:00:00.000Z',
  }
}

function makeGmTriggeredEvent(params: {
  correlationId: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
}): StoredEvent {
  return {
    sessionId: 'session_1',
    type: 'gm_triggered',
    severity: 'info',
    correlationId: params.correlationId,
    payload: {
      triggerReason: 'post_turn_observation',
      turnIndex: 1,
      interactionCount: 1,
      stateBefore: { progression: 'intro', topicsCovered: [] },
      ...(params.latencyMs !== undefined ? { latencyMs: params.latencyMs } : {}),
      ...(params.inputTokens !== undefined ? { inputTokens: params.inputTokens } : {}),
      ...(params.outputTokens !== undefined ? { outputTokens: params.outputTokens } : {}),
    },
    createdAt: '2026-04-30T10:00:01.000Z',
  }
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
})

describe('GetTurnMetricsUseCase — empty and single turn', () => {
  it('returns empty report for empty event log', async () => {
    const useCase = createUseCase([])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.sessionId).toBe('session_1')
    expect(report.turns).toEqual([])
    expect(report.summary).toEqual({
      totalTurns: 0,
      turnsWithGm: 0,
      avgAvatarLatencyMs: 0,
      avgTotalTurnLatencyMs: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgGmLatencyMs: null,
    })
    expect(findBySessionIdMock).toHaveBeenCalledWith('session_1', { limit: 500 })
  })

  it('maps single turn without GM event as hasGm false', async () => {
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_1',
        turnIndex: 1,
        avatarLatencyMs: 120,
        totalTurnLatencyMs: 180,
        inputTokens: 20,
        outputTokens: 30,
        totalTokens: 50,
      }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns).toEqual([
      {
        turnIndex: 1,
        correlationId: 'corr_1',
        avatarLatencyMs: 120,
        totalTurnLatencyMs: 180,
        overheadMs: 60,
        inputTokens: 20,
        outputTokens: 30,
        totalTokens: 50,
        model: 'model-x',
        hasGm: false,
      },
    ])
  })

  it('maps single turn with matching GM event', async () => {
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_1',
        turnIndex: 1,
        avatarLatencyMs: 100,
        totalTurnLatencyMs: 160,
        inputTokens: 12,
        outputTokens: 18,
        totalTokens: 30,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_1',
        latencyMs: 40,
        inputTokens: 7,
        outputTokens: 9,
      }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns[0]).toEqual({
      turnIndex: 1,
      correlationId: 'corr_1',
      avatarLatencyMs: 100,
      totalTurnLatencyMs: 160,
      overheadMs: 60,
      inputTokens: 12,
      outputTokens: 18,
      totalTokens: 30,
      model: 'model-x',
      hasGm: true,
      gmLatencyMs: 40,
      gmInputTokens: 7,
      gmOutputTokens: 9,
    })
  })
})

describe('GetTurnMetricsUseCase — mixed turns and summaries', () => {
  it('computes mixed-turn summary for three turns with two GM matches', async () => {
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_3',
        turnIndex: 3,
        avatarLatencyMs: 300,
        totalTurnLatencyMs: 420,
        inputTokens: 30,
        outputTokens: 60,
        totalTokens: 90,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_3',
        latencyMs: 90,
        inputTokens: 21,
        outputTokens: 23,
      }),
      makeTurnCompletedEvent({
        correlationId: 'corr_2',
        turnIndex: 2,
        avatarLatencyMs: 200,
        totalTurnLatencyMs: 300,
        inputTokens: 20,
        outputTokens: 40,
        totalTokens: 60,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_2',
        latencyMs: 50,
        inputTokens: 11,
        outputTokens: 13,
      }),
      makeTurnCompletedEvent({
        correlationId: 'corr_1',
        turnIndex: 1,
        avatarLatencyMs: 100,
        totalTurnLatencyMs: 150,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns.map((turn) => turn.turnIndex)).toEqual([1, 2, 3])
    expect(report.summary).toEqual({
      totalTurns: 3,
      turnsWithGm: 2,
      avgAvatarLatencyMs: 200,
      avgTotalTurnLatencyMs: 290,
      avgInputTokens: 20,
      avgOutputTokens: 40,
      avgGmLatencyMs: 70,
    })
  })
})

describe('GetTurnMetricsUseCase — gm edge cases', () => {
  it('ignores legacy gm_triggered events missing latency payload', async () => {
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_1',
        turnIndex: 1,
        avatarLatencyMs: 100,
        totalTurnLatencyMs: 150,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      }),
      makeGmTriggeredEvent({ correlationId: 'corr_1', inputTokens: 8, outputTokens: 9 }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns[0]?.hasGm).toBe(false)
    expect(report.turns[0]?.gmLatencyMs).toBeUndefined()
    expect(report.summary.avgGmLatencyMs).toBeNull()
  })

  it('uses first gm_triggered event for duplicate correlation ids and warns', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_1',
        turnIndex: 1,
        avatarLatencyMs: 100,
        totalTurnLatencyMs: 150,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_1',
        latencyMs: 22,
        inputTokens: 5,
        outputTokens: 6,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_1',
        latencyMs: 99,
        inputTokens: 8,
        outputTokens: 8,
      }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns[0]?.gmLatencyMs).toBe(22)
    expect(warnSpy).toHaveBeenCalledWith(
      '[metrics] Duplicate gm_triggered event for correlationId:',
      'corr_1',
    )
    warnSpy.mockRestore()
  })

  it('ignores gm_triggered events with orphan correlation ids', async () => {
    const useCase = createUseCase([
      makeTurnCompletedEvent({
        correlationId: 'corr_turn',
        turnIndex: 1,
        avatarLatencyMs: 110,
        totalTurnLatencyMs: 160,
        inputTokens: 11,
        outputTokens: 19,
        totalTokens: 30,
      }),
      makeGmTriggeredEvent({
        correlationId: 'corr_orphan',
        latencyMs: 45,
        inputTokens: 7,
        outputTokens: 8,
      }),
    ])

    const report = await useCase.execute({ sessionId: 'session_1' })

    expect(report.turns).toEqual([
      expect.objectContaining({
        correlationId: 'corr_turn',
        hasGm: false,
      }),
    ])
    expect(report.summary.avgGmLatencyMs).toBeNull()
  })
})
