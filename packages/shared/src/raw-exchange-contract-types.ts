import type { LlmResponseMetrics } from './llm-contract-types.js'

/** Wire response for the authenticated raw `/v1/exchange` boundary. */
export type RawExchangeResponse = {
  requestId: string
  reply: string
} & LlmResponseMetrics
