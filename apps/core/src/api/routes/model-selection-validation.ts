import {
  isAllowedModelForProvider,
  isModelSelectionProviderName,
  type AvatarLlmOverride,
  type ModelProfile,
  type ScenarioModelSelection,
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
  if (value.defaultProfile === undefined && value.gameMasterOverride === undefined) {
    return 'modelSelection must define defaultProfile or gameMasterOverride when provided'
  }

  return (
    validateModelProfile(value.defaultProfile, 'modelSelection.defaultProfile') ??
    validateModelProfile(value.gameMasterOverride, 'modelSelection.gameMasterOverride')
  )
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
