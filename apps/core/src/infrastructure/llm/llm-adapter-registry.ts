import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { ProviderName } from '../../domain/model-config/index.js'
import { LlmError } from './llm.error.js'

export type LlmAdapterRegistry = {
  get(provider: ProviderName): ILlmAdapter
}

export class DefaultLlmAdapterRegistry implements LlmAdapterRegistry {
  constructor(private readonly adapters: Partial<Record<ProviderName, ILlmAdapter>>) {}

  get(provider: ProviderName): ILlmAdapter {
    const adapter = this.adapters[provider]
    if (adapter !== undefined) return adapter

    throw new LlmError(provider, `LLM provider ${provider} is not configured`, 503)
  }
}
