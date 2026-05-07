import type { SessionEventRecord, TurnMetrics } from '@gami/shared'

export type TurnProfilerSort = 'slowest-total' | 'slowest-avatar' | 'latest-turn'

export type TurnProfilerFilter = {
  gmOnly: boolean
  sort: TurnProfilerSort
  limit: number
}

export type TurnProfilerRow = {
  turnIndex: number
  correlationId: string
  conversationId: string | null
  totalLatencyMs: number
  avatarLatencyMs: number
  gmLatencyMs: number | null
  overheadLatencyMs: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  gmInputTokens: number | null
  gmOutputTokens: number | null
  hasGm: boolean
  model: string
}

const DEFAULT_LIMIT = 20

export function buildTurnProfilerRows(
  turns: TurnMetrics[],
  recentEvents: SessionEventRecord[],
): TurnProfilerRow[] {
  const conversationByCorrelation = new Map<string, string>()

  for (const event of recentEvents) {
    if (event.type !== 'turn_completed') continue
    if (!('conversationId' in event.payload)) continue
    conversationByCorrelation.set(event.correlationId, event.payload.conversationId)
  }

  return turns.map((turn) => ({
    turnIndex: turn.turnIndex,
    correlationId: turn.correlationId,
    conversationId: conversationByCorrelation.get(turn.correlationId) ?? null,
    totalLatencyMs: turn.totalTurnLatencyMs,
    avatarLatencyMs: turn.avatarLatencyMs,
    gmLatencyMs: turn.gmLatencyMs ?? null,
    overheadLatencyMs: turn.overheadMs,
    totalTokens: turn.totalTokens,
    inputTokens: turn.inputTokens,
    outputTokens: turn.outputTokens,
    gmInputTokens: turn.gmInputTokens ?? null,
    gmOutputTokens: turn.gmOutputTokens ?? null,
    hasGm: turn.hasGm,
    model: turn.model,
  }))
}

export function applyTurnProfilerFilter(
  rows: TurnProfilerRow[],
  filter: TurnProfilerFilter,
): TurnProfilerRow[] {
  const filtered = filter.gmOnly ? rows.filter((row) => row.hasGm) : rows
  const sorted = [...filtered].sort((left, right) => compareRows(left, right, filter.sort))
  return sorted.slice(0, Math.max(1, filter.limit || DEFAULT_LIMIT))
}

export function describeTurnLatency(row: TurnProfilerRow): string {
  return `total ${String(row.totalLatencyMs)}ms · avatar ${String(row.avatarLatencyMs)}ms · gm ${row.gmLatencyMs !== null ? `${String(row.gmLatencyMs)}ms` : '-'} · overhead ${String(row.overheadLatencyMs)}ms`
}

export function describeTurnTokens(row: TurnProfilerRow): string {
  return `tokens ${String(row.totalTokens)} (in ${String(row.inputTokens)} / out ${String(row.outputTokens)})${row.gmInputTokens !== null || row.gmOutputTokens !== null ? ` · gm in ${String(row.gmInputTokens ?? 0)} / out ${String(row.gmOutputTokens ?? 0)}` : ''}`
}

function compareRows(
  left: TurnProfilerRow,
  right: TurnProfilerRow,
  sort: TurnProfilerSort,
): number {
  if (sort === 'latest-turn') {
    return right.turnIndex - left.turnIndex
  }
  if (sort === 'slowest-avatar') {
    return right.avatarLatencyMs - left.avatarLatencyMs
  }
  return right.totalLatencyMs - left.totalLatencyMs
}
