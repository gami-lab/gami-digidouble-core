import { normalizeLanguageTag, type ListVoicesResponse } from '@gami/shared'
import type { ITextToSpeechAdapter } from '../../ports/ITextToSpeechAdapter.js'
import { DomainError } from '../../../domain/errors.js'

/** Lists the active text-to-speech provider's voices for admin voice selection. */
export class ListVoicesUseCase {
  constructor(private readonly textToSpeechAdapter: ITextToSpeechAdapter) {}

  async execute(input: { language?: string } = {}): Promise<ListVoicesResponse> {
    const language = normalizeLanguageTag(input.language)
    if (language === null) {
      throw new DomainError('VALIDATION_ERROR', 'language must be a BCP-47 language tag.')
    }
    const provider = this.textToSpeechAdapter.provider
    if (provider === null) return { provider: null, voices: [] }

    const [voices, defaultVoiceId] = await Promise.all([
      this.textToSpeechAdapter.listVoices(language === undefined ? {} : { language }),
      this.textToSpeechAdapter.getDefaultVoiceId(language),
    ])
    return { provider, voices, ...(defaultVoiceId === undefined ? {} : { defaultVoiceId }) }
  }
}
