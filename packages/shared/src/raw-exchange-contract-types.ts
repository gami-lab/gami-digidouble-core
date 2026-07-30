import type { ModelSelectionOverride } from './model-catalog.js'
import type { LlmResponseMetrics } from './llm-contract-types.js'

/** Wire request for the authenticated raw `/v1/exchange` boundary. */
export type RawExchangeRequest = {
  message: string
  systemPrompt?: string
  model?: ModelSelectionOverride
}

/** Wire response for the authenticated raw `/v1/exchange` boundary. */
export type RawExchangeResponse = {
  requestId: string
  reply: string
} & LlmResponseMetrics
