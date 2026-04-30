import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type {
  TurnMetrics,
  TurnMetricsReport,
  TurnMetricsSummary,
} from '../../../domain/metrics/index.js'

const EVENT_FETCH_LIMIT = 500

export type GetTurnMetricsInput = {
  sessionId: string
}

type TurnCompletedPayload = {
  correlationId: string
  turnIndex: number
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
}

type GmPayload = {
  latencyMs: number
  inputTokens: number
  outputTokens: number
}

export class GetTurnMetricsUseCase {
  constructor(private readonly eventLogRepository: IEventLogRepository) {}

  async execute(input: GetTurnMetricsInput): Promise<TurnMetricsReport> {
    const events = await this.eventLogRepository.findBySessionId(input.sessionId, {
      limit: EVENT_FETCH_LIMIT,
    })
    const gmByCorrelationId = this.buildGmMap(events)
    const turns = events
      .filter((event) => event.type === 'turn_completed')
      .flatMap((event) => this.toTurnMetrics(event, gmByCorrelationId))
      .sort((left, right) => left.turnIndex - right.turnIndex)

    return {
      sessionId: input.sessionId,
      checkedAt: new Date().toISOString(),
      summary: buildSummary(turns),
      turns,
    }
  }

  private buildGmMap(events: StoredEvent[]): Map<string, GmPayload> {
    const gmByCorrelationId = new Map<string, GmPayload>()

    for (const event of events) {
      if (event.type !== 'gm_triggered') continue
      const correlationId = event.correlationId
      if (correlationId === undefined) continue
      const payload = extractGmPayload(event.payload)
      if (payload === null) continue
      if (gmByCorrelationId.has(correlationId)) {
        console.warn('[metrics] Duplicate gm_triggered event for correlationId:', correlationId)
        continue
      }
      gmByCorrelationId.set(correlationId, payload)
    }

    return gmByCorrelationId
  }

  private toTurnMetrics(
    event: StoredEvent,
    gmByCorrelationId: Map<string, GmPayload>,
  ): TurnMetrics[] {
    const payload = extractTurnCompletedPayload(event)
    if (payload === null) return []
    const gmPayload = gmByCorrelationId.get(payload.correlationId)

    return [
      {
        turnIndex: payload.turnIndex,
        correlationId: payload.correlationId,
        avatarLatencyMs: payload.avatarLatencyMs,
        totalTurnLatencyMs: payload.totalTurnLatencyMs,
        overheadMs: payload.totalTurnLatencyMs - payload.avatarLatencyMs,
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        totalTokens: payload.totalTokens,
        model: payload.model,
        hasGm: gmPayload !== undefined,
        ...(gmPayload !== undefined
          ? {
              gmLatencyMs: gmPayload.latencyMs,
              gmInputTokens: gmPayload.inputTokens,
              gmOutputTokens: gmPayload.outputTokens,
            }
          : {}),
      },
    ]
  }
}

function extractTurnCompletedPayload(event: StoredEvent): TurnCompletedPayload | null {
  const correlationId = typeof event.correlationId === 'string' ? event.correlationId : null
  const payload = event.payload
  const turnIndex = readNumber(payload['turnIndex'])
  const avatarLatencyMs = readNumber(payload['avatarLatencyMs'])
  const totalTurnLatencyMs = readNumber(payload['totalTurnLatencyMs'])
  const inputTokens = readNumber(payload['inputTokens'])
  const outputTokens = readNumber(payload['outputTokens'])
  const totalTokens = readNumber(payload['totalTokens'])
  const model = readString(payload['model'])

  if (
    correlationId === null ||
    turnIndex === null ||
    avatarLatencyMs === null ||
    totalTurnLatencyMs === null ||
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    model === null
  ) {
    return null
  }

  return {
    correlationId,
    turnIndex,
    avatarLatencyMs,
    totalTurnLatencyMs,
    inputTokens,
    outputTokens,
    totalTokens,
    model,
  }
}

function extractGmPayload(payload: Record<string, unknown>): GmPayload | null {
  const latencyMs = readNumber(payload['latencyMs'])
  const inputTokens = readNumber(payload['inputTokens'])
  const outputTokens = readNumber(payload['outputTokens'])

  if (latencyMs === null || inputTokens === null || outputTokens === null) {
    return null
  }

  return { latencyMs, inputTokens, outputTokens }
}

function buildSummary(turns: TurnMetrics[]): TurnMetricsSummary {
  if (turns.length === 0) {
    return {
      totalTurns: 0,
      turnsWithGm: 0,
      avgAvatarLatencyMs: 0,
      avgTotalTurnLatencyMs: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgGmLatencyMs: null,
    }
  }

  const turnsWithGm = turns.filter((turn) => turn.hasGm)
  return {
    totalTurns: turns.length,
    turnsWithGm: turnsWithGm.length,
    avgAvatarLatencyMs: average(turns.map((turn) => turn.avatarLatencyMs)),
    avgTotalTurnLatencyMs: average(turns.map((turn) => turn.totalTurnLatencyMs)),
    avgInputTokens: average(turns.map((turn) => turn.inputTokens)),
    avgOutputTokens: average(turns.map((turn) => turn.outputTokens)),
    avgGmLatencyMs:
      turnsWithGm.length === 0 ? null : average(turnsWithGm.map((turn) => turn.gmLatencyMs ?? 0)),
  }
}

function average(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
