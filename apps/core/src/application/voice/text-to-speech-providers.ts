import type { TextToSpeechProviderName } from '@gami/shared'
import type { ITextToSpeechAdapter } from '../ports/ITextToSpeechAdapter.js'

/**
 * The text-to-speech providers that have credentials, plus the default one. Scenarios and avatars
 * may pick any available provider; the default applies when they pick none (or one that lost its
 * credentials).
 */
export class TextToSpeechProviders {
  private readonly adapters: ReadonlyMap<TextToSpeechProviderName, ITextToSpeechAdapter>
  /** Null when the configured default has no credentials or text-to-speech has no default. */
  readonly defaultProvider: TextToSpeechProviderName | null

  constructor(
    adapters: readonly ITextToSpeechAdapter[] = [],
    defaultProvider: TextToSpeechProviderName | null = null,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.provider, adapter]))
    this.defaultProvider =
      defaultProvider !== null && this.adapters.has(defaultProvider) ? defaultProvider : null
  }

  get available(): TextToSpeechProviderName[] {
    return [...this.adapters.keys()]
  }

  get(provider: TextToSpeechProviderName): ITextToSpeechAdapter | undefined {
    return this.adapters.get(provider)
  }
}
