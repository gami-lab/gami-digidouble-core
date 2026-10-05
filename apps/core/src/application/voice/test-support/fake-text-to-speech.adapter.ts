import {
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
  type ITextToSpeechAdapter,
  type TextToSpeechInput,
  type TextToSpeechOptions,
  type TextToSpeechStream,
} from '../../ports/ITextToSpeechAdapter.js'
import type { VoiceOption } from '@gami/shared'

/** Audio chunks streamed for every request, or the failure to throw. */
export type FakeTextToSpeechOutcome = readonly Uint8Array[] | TextToSpeechError

/** Deterministic adapter for application, route, and stack tests. */
export const FAKE_DEFAULT_VOICE: VoiceOption = {
  voiceId: 'fake-default-voice',
  name: 'Fake',
  language: 'en',
}

export class FakeTextToSpeechAdapter implements ITextToSpeechAdapter {
  readonly provider = 'gradium' as const
  readonly requests: TextToSpeechInput[] = []

  constructor(private readonly outcome: FakeTextToSpeechOutcome = [Uint8Array.from([1, 2, 3])]) {}

  listVoices(): Promise<VoiceOption[]> {
    return Promise.resolve([FAKE_DEFAULT_VOICE])
  }

  getDefaultVoiceId(): Promise<string | undefined> {
    return Promise.resolve(FAKE_DEFAULT_VOICE.voiceId)
  }

  synthesize(input: TextToSpeechInput, options?: TextToSpeechOptions): Promise<TextToSpeechStream> {
    return Promise.resolve().then(() => {
      throwIfTextToSpeechCancelled(options?.signal, 'before_synthesis')
      const normalizedInput = normalizeTextToSpeechInput(input)
      this.requests.push(normalizedInput)
      const { requestId, messageId, format } = normalizedInput
      if (this.outcome instanceof TextToSpeechError) throw this.outcome
      const chunks = this.outcome
      async function* audio(): AsyncGenerator<Uint8Array> {
        for (const chunk of chunks) {
          throwIfTextToSpeechCancelled(options?.signal, 'during_synthesis')
          await Promise.resolve()
          yield chunk
        }
      }
      return { audio: audio(), metadata: { requestId, messageId, format } }
    })
  }
}
