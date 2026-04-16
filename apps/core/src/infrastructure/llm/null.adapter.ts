import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'

/**
 * Deterministic no-network adapter for tests and local development.
 * Never makes real LLM calls; returns configurable fixed responses.
 */
export class NullLlmAdapter implements ILlmAdapter {
  private readonly fixedContent: string
  private readonly fixedModel: string

  constructor(fixedContent = 'null adapter response', fixedModel = 'null') {
    this.fixedContent = fixedContent
    this.fixedModel = fixedModel
  }

  complete(_request: LlmRequest): Promise<LlmResponse> {
    return Promise.resolve({
      content: this.fixedContent,
      model: this.fixedModel,
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
  }
}
