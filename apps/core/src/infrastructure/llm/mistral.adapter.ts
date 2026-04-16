import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'

/** Placeholder — Mistral adapter is not yet implemented. */
export class MistralAdapter implements ILlmAdapter {
  complete(_request: LlmRequest): Promise<LlmResponse> {
    return Promise.reject(new LlmError('mistral', 'Not implemented'))
  }
}
