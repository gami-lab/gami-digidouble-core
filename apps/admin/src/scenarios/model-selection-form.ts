import type {
  AvatarLlmOverride,
  ModelSelectionProviderName,
  ScenarioModelSelection,
} from '@gami/shared'

export type ModelSelectionFormValue = {
  provider: string
  model: string
}

export const EMPTY_MODEL_SELECTION: ModelSelectionFormValue = {
  provider: '',
  model: '',
}

export function fromAvatarLlmOverride(
  value: AvatarLlmOverride | undefined,
): ModelSelectionFormValue {
  return {
    provider: value?.provider ?? '',
    model: value?.model ?? '',
  }
}

export function fromScenarioModelSelection(value: ScenarioModelSelection | undefined): {
  defaultProfile: ModelSelectionFormValue
  gameMasterOverride: ModelSelectionFormValue
} {
  return {
    defaultProfile: toFormValue(value?.defaultProfile),
    gameMasterOverride: toFormValue(value?.gameMasterOverride),
  }
}

export function isModelSelectionEmpty(value: ModelSelectionFormValue): boolean {
  return value.provider.trim().length === 0 && value.model.trim().length === 0
}

export function isModelSelectionComplete(value: ModelSelectionFormValue): boolean {
  return value.provider.trim().length > 0 && value.model.trim().length > 0
}

export function hasPartialModelSelection(value: ModelSelectionFormValue): boolean {
  return !isModelSelectionEmpty(value) && !isModelSelectionComplete(value)
}

export function toAvatarLlmOverride(value: ModelSelectionFormValue): AvatarLlmOverride | null {
  if (isModelSelectionEmpty(value)) return null

  return {
    provider: value.provider.trim() as ModelSelectionProviderName,
    model: value.model.trim(),
  }
}

export function toScenarioModelSelection(args: {
  defaultProfile: ModelSelectionFormValue
  gameMasterOverride: ModelSelectionFormValue
}): ScenarioModelSelection | undefined {
  const next: ScenarioModelSelection = {
    ...(isModelSelectionComplete(args.defaultProfile)
      ? {
          defaultProfile: {
            provider: args.defaultProfile.provider.trim() as ModelSelectionProviderName,
            model: args.defaultProfile.model.trim(),
          },
        }
      : {}),
    ...(isModelSelectionComplete(args.gameMasterOverride)
      ? {
          gameMasterOverride: {
            provider: args.gameMasterOverride.provider.trim() as ModelSelectionProviderName,
            model: args.gameMasterOverride.model.trim(),
          },
        }
      : {}),
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function toFormValue(
  profile: ScenarioModelSelection['defaultProfile'] | undefined,
): ModelSelectionFormValue {
  return {
    provider: profile?.provider ?? '',
    model: profile?.model ?? '',
  }
}
