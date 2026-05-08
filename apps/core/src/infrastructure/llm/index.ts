import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { AnthropicAdapter } from './anthropic.adapter.js'
import { MistralAdapter } from './mistral.adapter.js'
import { NullLlmAdapter } from './null.adapter.js'
import { ObservedLlmAdapter } from './observed.adapter.js'
import { OpenAiAdapter } from './openai.adapter.js'

export { LlmError } from './llm.error.js'
export { LlmUserFactExtractor } from './llm-user-fact-extractor.js'
export { NullLlmAdapter } from './null.adapter.js'
export { ObservedLlmAdapter } from './observed.adapter.js'

export interface LlmConfig {
  provider: string
  openaiApiKey?: string
  anthropicApiKey?: string
  mistralApiKey?: string
}

export function createLlmAdapter(
  config: LlmConfig,
  observability?: IObservabilityAdapter,
): ILlmAdapter {
  const adapter = createBaseLlmAdapter(config)
  return observability === undefined ? adapter : new ObservedLlmAdapter(adapter, observability)
}

function createBaseLlmAdapter(config: LlmConfig): ILlmAdapter {
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
