/**
 * Provider-neutral voice and binary audio-delivery contracts.
 *
 * These types describe the public boundary only. A voiceKey is a product-owned
 * logical key; it is not a provider voice identifier or credential-bearing
 * configuration. Provider resolution belongs behind the Core application port.
 */

import { isLanguageTag } from './language-contract.js'

export const AUDIO_OUTPUT_FORMATS = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'] as const
export const AUDIO_METADATA_ID_MAX_LENGTH = 128

export type AudioOutputFormat = (typeof AUDIO_OUTPUT_FORMATS)[number]

/** Optional scenario/avatar voice selection resolved by Core, not by clients. */
export type VoiceConfiguration = {
  voiceKey: string
  language?: string
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

export function isVoiceConfiguration(value: unknown): value is VoiceConfiguration {
  if (!isRecord(value) || !hasOnlyKeys(value, ['voiceKey', 'language'])) return false
  return (
    isNonEmptyString(value['voiceKey']) &&
    (value['language'] === undefined || isLanguageTag(value['language']))
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
