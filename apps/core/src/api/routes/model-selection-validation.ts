import {
  isAllowedModelForProvider,
  isModelSelectionProviderName,
  SCENARIO_MODEL_SLOTS,
  type AvatarLlmOverride,
  type ModelProfile,
  type ScenarioModelSelection,
  isVoiceConfiguration,
} from '@gami/shared'

function validateRequiredModel(model: string, field: string): string | null {
  if (model.trim().length === 0) {
    return `${field} must be a non-empty string`
  }

  return null
}

export function validateAvatarLlmOverride(
  value: AvatarLlmOverride | null | undefined,
): string | null {
  if (value === undefined || value === null) return null

  if (value.provider === undefined || value.model === undefined) {
    return 'llmOverride.provider and llmOverride.model must both be provided when setting an override'
  }
  if (!isModelSelectionProviderName(value.provider)) {
    return 'llmOverride.provider must be one of: openai, anthropic, mistral, xai'
  }

  const modelError = validateRequiredModel(value.model, 'llmOverride.model')
  if (modelError !== null) return modelError
  if (!isAllowedModelForProvider(value.provider, value.model)) {
    return 'llmOverride.model must be one of the allowed catalog models for the selected provider'
  }

  return null
}

export function validateScenarioModelSelection(
  value: ScenarioModelSelection | null | undefined,
): string | null {
  if (value === undefined || value === null) return null
  if (SCENARIO_MODEL_SLOTS.every((slot) => value[slot] === undefined)) {
    return `modelSelection must define at least one of ${SCENARIO_MODEL_SLOTS.join(', ')} when provided`
  }

  for (const slot of SCENARIO_MODEL_SLOTS) {
    const error = validateModelProfile(value[slot], `modelSelection.${slot}`)
    if (error !== null) return error
  }
  return null
}

export function validateVoiceConfiguration(value: unknown, allowNull: boolean): string | null {
  if (value === undefined) return null
  if (value === null) return allowNull ? null : 'voiceConfig cannot be null when creating a record'
  return isVoiceConfiguration(value)
    ? null
    : 'voiceConfig must contain only a supported provider and a voiceId'
}

function validateModelProfile(profile: ModelProfile | undefined, field: string): string | null {
  if (profile === undefined) return null
  if (!isModelSelectionProviderName(profile.provider)) {
    return `${field}.provider must be one of: openai, anthropic, mistral, xai`
  }

  const modelError = validateRequiredModel(profile.model, `${field}.model`)
  if (modelError !== null) return modelError
  if (!isAllowedModelForProvider(profile.provider, profile.model)) {
    return `${field}.model must be one of the allowed catalog models for the selected provider`
  }

  return null
}
