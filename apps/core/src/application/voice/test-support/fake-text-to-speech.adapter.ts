import {
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
  type ITextToSpeechAdapter,
  type TextToSpeechInput,
  type TextToSpeechOptions,
  type TextToSpeechResult,
} from '../../ports/ITextToSpeechAdapter.js'
import type { VoiceOption } from '@gami/shared'

export type FakeTextToSpeechOutcome = TextToSpeechResult | TextToSpeechError

/** Deterministic adapter for application, route, and stack tests. */
export const FAKE_DEFAULT_VOICE: VoiceOption = {
  voiceId: 'fake-default-voice',
  name: 'Fake',
  language: 'en',
}

export class FakeTextToSpeechAdapter implements ITextToSpeechAdapter {
  readonly provider = 'gradium' as const
  readonly requests: TextToSpeechInput[] = []

  constructor(
    private readonly outcome: FakeTextToSpeechOutcome = {
      audio: Uint8Array.from([1, 2, 3]),
      metadata: {
        requestId: 'fake-request',
        messageId: 'fake-message',
        format: 'audio/wav',
        byteLength: 3,
      },
    },
  ) {}

  listVoices(): Promise<VoiceOption[]> {
    return Promise.resolve([FAKE_DEFAULT_VOICE])
  }

  getDefaultVoiceId(): Promise<string | undefined> {
    return Promise.resolve(FAKE_DEFAULT_VOICE.voiceId)
  }

  synthesize(input: TextToSpeechInput, options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
    return Promise.resolve().then(() => {
      throwIfTextToSpeechCancelled(options?.signal, 'before_synthesis')
      const normalizedInput = normalizeTextToSpeechInput(input)
      this.requests.push(normalizedInput)
      throwIfTextToSpeechCancelled(options?.signal, 'during_synthesis')
      if (this.outcome instanceof TextToSpeechError) throw this.outcome
      return this.outcome
    })
  }
}
