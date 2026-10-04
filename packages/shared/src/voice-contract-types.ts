/**
 * Provider-neutral voice and binary audio-delivery contracts.
 *
 * A voice selection names the text-to-speech provider and that provider's own voice id, picked
 * from the admin voice list. Credentials and provider-native options never cross this boundary.
 */

export const AUDIO_OUTPUT_FORMATS = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'] as const
export const AUDIO_METADATA_ID_MAX_LENGTH = 128

export type AudioOutputFormat = (typeof AUDIO_OUTPUT_FORMATS)[number]

export const TEXT_TO_SPEECH_PROVIDER_NAMES = ['gradium'] as const
export const VOICE_ID_MAX_LENGTH = 128

export type TextToSpeechProviderName = (typeof TEXT_TO_SPEECH_PROVIDER_NAMES)[number]

/**
 * Optional scenario/avatar voice selection. When absent (or saved for another provider), Core
 * uses the active provider's default voice for the scenario language.
 */
export type VoiceConfiguration = {
  provider: TextToSpeechProviderName
  voiceId: string
}

/** One selectable voice from the active text-to-speech provider. */
export type VoiceOption = {
  voiceId: string
  name: string
  language?: string
  description?: string
  gender?: string
}

/** `GET /v1/admin/voices`; `provider` is null when text-to-speech is disabled. */
export type ListVoicesResponse = {
  provider: TextToSpeechProviderName | null
  voices: VoiceOption[]
  /** Voice used when nothing is selected, for the requested language. */
  defaultVoiceId?: string
}

export type VoiceConfigurationUpdate = VoiceConfiguration | null

/** Client playback/delivery preference; it cannot select provider internals. */
export type ClientAudioOptions = {
  enabled?: boolean
  format?: AudioOutputFormat
}

/** Minimal request body for a future binary audio-delivery route. */
export type AudioDeliveryRequest = Pick<ClientAudioOptions, 'format'>

/** Bounded metadata accompanying transient binary audio delivery. */
export type AudioDeliveryMetadata = {
  requestId: string
  messageId: string
  format: AudioOutputFormat
  byteLength: number
  durationMs?: number
}

export function isAudioOutputFormat(value: unknown): value is AudioOutputFormat {
  return typeof value === 'string' && (AUDIO_OUTPUT_FORMATS as readonly string[]).includes(value)
}

export function isTextToSpeechProviderName(value: unknown): value is TextToSpeechProviderName {
  return (
    typeof value === 'string' &&
    (TEXT_TO_SPEECH_PROVIDER_NAMES as readonly string[]).includes(value)
  )
}

export function isVoiceConfiguration(value: unknown): value is VoiceConfiguration {
  if (!isRecord(value) || !hasOnlyKeys(value, ['provider', 'voiceId'])) return false
  return (
    isTextToSpeechProviderName(value['provider']) &&
    isBoundedNonEmptyString(value['voiceId'], VOICE_ID_MAX_LENGTH)
  )
}

export function isClientAudioOptions(value: unknown): value is ClientAudioOptions {
  if (!isRecord(value) || !hasOnlyKeys(value, ['enabled', 'format'])) return false
  return (
    (value['enabled'] === undefined || typeof value['enabled'] === 'boolean') &&
    (value['format'] === undefined || isAudioOutputFormat(value['format']))
  )
}

export function isAudioDeliveryRequest(value: unknown): value is AudioDeliveryRequest {
  if (!isRecord(value) || !hasOnlyKeys(value, ['format'])) return false
  return value['format'] === undefined || isAudioOutputFormat(value['format'])
}

export function isAudioDeliveryMetadata(value: unknown): value is AudioDeliveryMetadata {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'messageId', 'format', 'byteLength', 'durationMs'])
  ) {
    return false
  }
  return (
    isBoundedNonEmptyString(value['requestId'], AUDIO_METADATA_ID_MAX_LENGTH) &&
    isBoundedNonEmptyString(value['messageId'], AUDIO_METADATA_ID_MAX_LENGTH) &&
    isAudioOutputFormat(value['format']) &&
    isPositiveSafeInteger(value['byteLength']) &&
    (value['durationMs'] === undefined || isNonNegativeSafeInteger(value['durationMs']))
  )
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return isNonEmptyString(value) && value.length <= maxLength
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
