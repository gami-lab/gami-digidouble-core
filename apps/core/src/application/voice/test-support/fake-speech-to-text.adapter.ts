import {
  isSpeechToTextError,
  normalizeSpeechToTextInput,
  SpeechToTextError,
  throwIfSpeechToTextCancelled,
  type SpeechToTextInput,
  type SpeechToTextResult,
} from '../../ports/ISpeechToTextAdapter.js'
import type { ISpeechToTextAdapter, SpeechToTextOptions } from '../../ports/ISpeechToTextAdapter.js'

export type FakeSpeechToTextOutcome = SpeechToTextResult | SpeechToTextError

/** Deterministic adapter for application, route, and cancellation tests. */
export class FakeSpeechToTextAdapter implements ISpeechToTextAdapter {
  readonly requests: SpeechToTextInput[] = []

  constructor(
    private readonly outcome: FakeSpeechToTextOutcome = { kind: 'final', transcript: 'Hello' },
  ) {}

  transcribe(input: SpeechToTextInput, options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
    return Promise.resolve().then(() => {
      throwIfSpeechToTextCancelled(options?.signal, 'before_transcription')
      const normalizedInput = normalizeSpeechToTextInput(input)
      this.requests.push(normalizedInput)
      throwIfSpeechToTextCancelled(options?.signal, 'during_transcription')
      if (isSpeechToTextError(this.outcome)) throw this.outcome
      return this.outcome
    })
  }
}
