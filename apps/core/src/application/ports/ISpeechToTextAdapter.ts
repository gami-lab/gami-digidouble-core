import type { SpeechToTextInput, SpeechToTextResult } from '../voice/speech-to-text.contracts.js'

export type {
  SpeechToTextFailure,
  SpeechToTextInput,
  SpeechToTextLimits,
  SpeechToTextMediaType,
  SpeechToTextResult,
} from '../voice/speech-to-text.contracts.js'
export {
  isSpeechToTextError,
  mapSpeechToTextError,
  normalizeFinalTranscript,
  normalizeSpeechToTextLanguage,
  normalizeSpeechToTextInput,
  SPEECH_TO_TEXT_LIMITS,
  SPEECH_TO_TEXT_MEDIA_TYPES,
  SpeechToTextError,
  throwIfSpeechToTextCancelled,
} from '../voice/speech-to-text.contracts.js'

export type SpeechToTextOptions = Readonly<{
  signal?: AbortSignal
}>

/** Provider-neutral speech-to-text capability. */
export interface ISpeechToTextAdapter {
  transcribe(input: SpeechToTextInput, options?: SpeechToTextOptions): Promise<SpeechToTextResult>
}
