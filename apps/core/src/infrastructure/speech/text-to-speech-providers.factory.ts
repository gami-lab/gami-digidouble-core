import type { TextToSpeechProviderName } from '@gami/shared'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import type {
  ITextToSpeechAdapter,
  TextToSpeechLimits,
} from '../../application/ports/ITextToSpeechAdapter.js'
import { TextToSpeechProviders } from '../../application/voice/text-to-speech-providers.js'
import { GradiumTextToSpeechAdapter } from './gradium-text-to-speech.adapter.js'
import {
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_TIMEOUT_MS,
  OpenAiTextToSpeechAdapter,
} from './openai-text-to-speech.adapter.js'

export type TextToSpeechProvidersConfig = Readonly<{
  /** Provider used when a scenario/avatar selects none; null for no default. */
  defaultProvider: TextToSpeechProviderName | null
  gradium: Readonly<{
    apiKey?: string
    baseUrl: string
    timeoutMs: number
  }>
  openai: Readonly<{ apiKey?: string }>
  limits: TextToSpeechLimits
}>

/** Registers every text-to-speech provider that has credentials. */
export function createTextToSpeechProviders(
  config: TextToSpeechProvidersConfig,
  observability: IObservabilityAdapter,
): TextToSpeechProviders {
  const adapters: ITextToSpeechAdapter[] = []
  const gradiumApiKey = presentKey(config.gradium.apiKey)
  if (gradiumApiKey !== undefined) {
    adapters.push(
      new GradiumTextToSpeechAdapter(
        { ...config.gradium, apiKey: gradiumApiKey, limits: config.limits },
        observability,
      ),
    )
  }
  const openaiApiKey = presentKey(config.openai.apiKey)
  if (openaiApiKey !== undefined) {
    adapters.push(
      new OpenAiTextToSpeechAdapter(
        {
          apiKey: openaiApiKey,
          model: DEFAULT_OPENAI_TTS_MODEL,
          timeoutMs: DEFAULT_OPENAI_TTS_TIMEOUT_MS,
          limits: config.limits,
        },
        observability,
      ),
    )
  }
  return new TextToSpeechProviders(adapters, config.defaultProvider)
}

function presentKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim()
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed
}
