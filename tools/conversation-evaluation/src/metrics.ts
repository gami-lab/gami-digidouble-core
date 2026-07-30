import type { MessageMetadata } from '@gami/shared'
import type { EvaluationMetrics, JudgeMetrics } from './contracts.js'

/** Preserve an API cost when supplied; represent an absent cost as unavailable. */
export function normalizeCostUsd(costUsd: MessageMetadata['costUsd']): number | null {
  return costUsd ?? null
}

export function normalizeMetrics(metadata: {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  costUsd?: number
}): EvaluationMetrics {
  return {
    model: metadata.model,
    latencyMs: metadata.latencyMs,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    totalTokens: metadata.totalTokens ?? metadata.inputTokens + metadata.outputTokens,
    costUsd: normalizeCostUsd(metadata.costUsd),
  }
}

export function normalizeJudgeMetrics(metadata: {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
}): JudgeMetrics {
  return {
    model: metadata.model,
    latencyMs: metadata.latencyMs,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    totalTokens: metadata.inputTokens + metadata.outputTokens,
  }
}
