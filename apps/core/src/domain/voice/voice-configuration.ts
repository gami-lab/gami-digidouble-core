import {
  isVoiceConfiguration,
  type TextToSpeechProviderName,
  type VoiceConfiguration,
} from '@gami/shared'
import { DomainError } from '../errors.js'

export const VOICE_CONFIGURATION_CONFIG_KEY = 'voiceConfig'

export function normalizeVoiceConfiguration(
  value: unknown,
  options: { allowClear: boolean },
): VoiceConfiguration | null | undefined {
  if (value === undefined) return undefined
  if (value === null) {
    if (options.allowClear) return null
    throw new DomainError('INVALID_INPUT', 'voiceConfig cannot be null when creating a record')
  }
  if (!isVoiceConfiguration(value)) {
    throw new DomainError(
      'INVALID_INPUT',
      'voiceConfig must contain a supported provider and a non-empty voiceId',
    )
  }

  return { provider: value.provider, voiceId: value.voiceId.trim() }
}

export function normalizeVoiceConfigurationMutation(
  config: Record<string, unknown> | undefined,
  value: unknown,
  allowClear: false,
): VoiceConfiguration | undefined
export function normalizeVoiceConfigurationMutation(
  config: Record<string, unknown> | undefined,
  value: unknown,
  allowClear: true,
): VoiceConfiguration | null | undefined

export function normalizeVoiceConfigurationMutation(
  config: Record<string, unknown> | undefined,
  value: unknown,
  allowClear: boolean,
): VoiceConfiguration | null | undefined {
  assertVoiceConfigurationIsNotEmbedded(config)
  return normalizeVoiceConfiguration(value, { allowClear })
}

export function assertVoiceConfigurationIsNotEmbedded(
  config: Record<string, unknown> | undefined,
): void {
  if (config?.[VOICE_CONFIGURATION_CONFIG_KEY] !== undefined) {
    throw new DomainError(
      'INVALID_INPUT',
      'voiceConfig must be provided as a top-level field, not inside config',
    )
  }
}

export function readVoiceConfiguration(
  config: Record<string, unknown>,
): VoiceConfiguration | undefined {
  const value = config[VOICE_CONFIGURATION_CONFIG_KEY]
  return isVoiceConfiguration(value) ? value : undefined
}

export function withoutVoiceConfiguration(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...config }
  Reflect.deleteProperty(result, VOICE_CONFIGURATION_CONFIG_KEY)
  return result
}

export function applyVoiceConfiguration(
  config: Record<string, unknown>,
  voiceConfig: VoiceConfiguration | null | undefined,
): Record<string, unknown> {
  if (voiceConfig === undefined) return { ...config }
  if (voiceConfig === null) return withoutVoiceConfiguration(config)

  return {
    ...withoutVoiceConfiguration(config),
    [VOICE_CONFIGURATION_CONFIG_KEY]: voiceConfig,
  }
}

/**
 * Picks the avatar voice, else the scenario voice. A selection saved for another provider is
 * skipped, so switching providers falls back to the provider default instead of failing.
 */
export function selectVoiceId(
  scenarioVoiceConfig: VoiceConfiguration | undefined,
  avatarVoiceConfig: VoiceConfiguration | undefined,
  provider: TextToSpeechProviderName,
): string | undefined {
  for (const voice of [avatarVoiceConfig, scenarioVoiceConfig]) {
    if (voice?.provider === provider) return voice.voiceId
  }
  return undefined
}
