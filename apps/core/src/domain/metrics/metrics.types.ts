export type TurnMetrics = {
  turnIndex: number
  correlationId: string
  conversationId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  overheadMs: number
  retrievalLatencyMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
  gmLatencyMs?: number
  gmInputTokens?: number
  gmOutputTokens?: number
}

export type TurnMetricsSummary = {
  totalTurns: number
  turnsWithGm: number
  avgAvatarLatencyMs: number
  avgTotalTurnLatencyMs: number
  avgInputTokens: number
  avgOutputTokens: number
  avgGmLatencyMs: number | null
}

export type TurnMetricsReport = {
  sessionId: string
  checkedAt: string
  summary: TurnMetricsSummary
  turns: TurnMetrics[]
}
