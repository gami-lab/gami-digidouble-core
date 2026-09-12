import {
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
  type ITextToSpeechAdapter,
  type TextToSpeechInput,
  type TextToSpeechOptions,
  type TextToSpeechResult,
} from '../../ports/ITextToSpeechAdapter.js'

export type FakeTextToSpeechOutcome = TextToSpeechResult | TextToSpeechError

/** Deterministic adapter for application, route, and stack tests. */
export class FakeTextToSpeechAdapter implements ITextToSpeechAdapter {
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
