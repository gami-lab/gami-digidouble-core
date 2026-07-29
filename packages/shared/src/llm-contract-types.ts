/** Required metrics returned for a completed LLM-backed response. */
export type LlmResponseMetrics = {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
}
