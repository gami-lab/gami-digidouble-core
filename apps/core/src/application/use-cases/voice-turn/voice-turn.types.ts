import type {
  SpeechToTextFailure,
  SpeechToTextInput,
  SpeechToTextOptions,
} from '../../ports/ISpeechToTextAdapter.js'

export type VoiceTurnInput = SpeechToTextInput
export type VoiceTurnOptions = SpeechToTextOptions

export type VoiceTurnDuplicateCode = 'in_flight' | 'completed' | 'expired' | 'conflict'

export class VoiceTurnError extends Error {
  readonly code: VoiceTurnDuplicateCode

  constructor(code: VoiceTurnDuplicateCode) {
    super(messageForVoiceTurnError(code))
    this.name = 'VoiceTurnError'
    this.code = code
  }
}

export function isVoiceTurnError(error: unknown): error is VoiceTurnError {
  return error instanceof VoiceTurnError
}

export type VoiceTurnFailureCode =
  SpeechToTextFailure['code'] | VoiceTurnDuplicateCode | 'turn_failure'

function messageForVoiceTurnError(code: VoiceTurnDuplicateCode): string {
  switch (code) {
    case 'in_flight':
      return 'Voice utterance is already being processed.'
    case 'completed':
      return 'Voice utterance has already been processed.'
    case 'expired':
      return 'Voice utterance processing expired and cannot be retried safely.'
    case 'conflict':
      return 'Voice utterance ID was already used for different audio.'
  }
}
