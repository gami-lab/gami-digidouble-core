import {
  normalizeLanguageTag,
  type ListVoicesResponse,
  type TextToSpeechProviderName,
} from '@gami/shared'
import type { TextToSpeechProviders } from '../../voice/text-to-speech-providers.js'
import { DomainError } from '../../../domain/errors.js'

/**
 * Lists the voices of one text-to-speech provider (the requested one, else the default, else the
 * first available) for admin voice selection, together with the providers a scenario or avatar may
 * pick.
 */
export class ListVoicesUseCase {
  constructor(private readonly textToSpeechProviders: TextToSpeechProviders) {}

  async execute(
    input: { language?: string; provider?: TextToSpeechProviderName } = {},
  ): Promise<ListVoicesResponse> {
    const language = normalizeLanguageTag(input.language)
    if (language === null) {
      throw new DomainError('VALIDATION_ERROR', 'language must be a BCP-47 language tag.')
    }
    const { available, defaultProvider } = this.textToSpeechProviders
    const provider = input.provider ?? defaultProvider ?? available[0] ?? null
    // A requested provider without credentials lists nothing, so a saved selection stays visible.
    const adapter = provider === null ? undefined : this.textToSpeechProviders.get(provider)
    const base = { defaultProvider, providers: available }
    if (adapter === undefined) return { ...base, provider: null, voices: [] }

    const [voices, defaultVoiceId] = await Promise.all([
      adapter.listVoices(language === undefined ? {} : { language }),
      adapter.getDefaultVoiceId(language),
    ])
    return {
      ...base,
      provider: adapter.provider,
      voices,
      ...(defaultVoiceId === undefined ? {} : { defaultVoiceId }),
    }
  }
}
