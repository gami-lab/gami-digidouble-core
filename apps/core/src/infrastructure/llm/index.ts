/**
 * Placeholder — LLM provider adapter layer.
 * Implemented in EPIC 1.2 (First LLM Loop + Observability).
 *
 * Will implement ILlmAdapter from application/ports/ILlmAdapter.ts.
 * Supported providers: OpenAI, Anthropic, Mistral (via role-based config).
 */
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import { AnthropicAdapter } from './anthropic.adapter.js'
import { MistralAdapter } from './mistral.adapter.js'
import { NullLlmAdapter } from './null.adapter.js'
import { OpenAiAdapter } from './openai.adapter.js'

export { LlmError } from './llm.error.js'
export { NullLlmAdapter } from './null.adapter.js'

export interface LlmConfig {
  provider: string
  openaiApiKey?: string
  anthropicApiKey?: string
  mistralApiKey?: string
}

export function createLlmAdapter(config: LlmConfig): ILlmAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAiAdapter(config.openaiApiKey ?? '')
    case 'anthropic':
      return new AnthropicAdapter(config.anthropicApiKey ?? '')
    case 'mistral':
      return new MistralAdapter(config.mistralApiKey ?? '')
    case 'null':
      return new NullLlmAdapter()
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`)
  }
}
