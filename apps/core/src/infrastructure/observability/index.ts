import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { ConsoleObservabilityAdapter } from './console.adapter.js'
import { LangfuseObservabilityAdapter } from './langfuse.adapter.js'

export { NullObservabilityAdapter } from './null.adapter.js'
export { ConsoleObservabilityAdapter } from './console.adapter.js'
export { LangfuseObservabilityAdapter } from './langfuse.adapter.js'

export interface ObservabilityConfig {
  langfusePublicKey?: string | undefined
  langfuseSecretKey?: string | undefined
  langfuseHost?: string | undefined
}

export function createObservabilityAdapter(config: ObservabilityConfig): IObservabilityAdapter {
  if (config.langfusePublicKey && config.langfuseSecretKey) {
    return new LangfuseObservabilityAdapter(
      config.langfusePublicKey,
      config.langfuseSecretKey,
      config.langfuseHost ?? 'https://cloud.langfuse.com',
    )
  }
  return new ConsoleObservabilityAdapter()
}
