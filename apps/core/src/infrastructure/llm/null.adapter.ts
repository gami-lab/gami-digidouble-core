import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamOptions,
  LlmStreamEvent,
} from '../../application/ports/ILlmAdapter.js'
import { completedEvent, deltaEvent, throwIfAborted } from './streaming.js'

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
    return Promise.resolve(this.buildResponse())
  }

  // A deterministic generator has no asynchronous work until a consumer requests a value.
  // eslint-disable-next-line @typescript-eslint/require-await
  async *stream(_request: LlmRequest, options?: LlmStreamOptions): AsyncIterable<LlmStreamEvent> {
    throwIfAborted(options?.signal)

    if (this.fixedContent.length > 0) {
      yield deltaEvent(this.fixedContent)
    }

    throwIfAborted(options?.signal)
    yield completedEvent(this.buildResponse())
  }

  private buildResponse(): LlmResponse {
    return {
      content: this.fixedContent,
      model: this.fixedModel,
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    }
  }
}
