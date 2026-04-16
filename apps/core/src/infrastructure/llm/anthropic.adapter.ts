import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'

/** Placeholder — Anthropic adapter is not yet implemented. */
export class AnthropicAdapter implements ILlmAdapter {
  complete(_request: LlmRequest): Promise<LlmResponse> {
    return Promise.reject(new LlmError('anthropic', 'Not implemented'))
  }
}
