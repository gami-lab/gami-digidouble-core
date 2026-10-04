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
  avatarOverride: ModelSelectionFormValue
  gameMasterOverride: ModelSelectionFormValue
  memoryOverride: ModelSelectionFormValue
} {
  return {
    defaultProfile: toFormValue(value?.defaultProfile),
    avatarOverride: toFormValue(value?.avatarOverride),
    gameMasterOverride: toFormValue(value?.gameMasterOverride),
    memoryOverride: toFormValue(value?.memoryOverride),
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

export function toScenarioModelSelection(args: {
  defaultProfile: ModelSelectionFormValue
  avatarOverride: ModelSelectionFormValue
  gameMasterOverride: ModelSelectionFormValue
  memoryOverride: ModelSelectionFormValue
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
    ...(isModelSelectionComplete(args.avatarOverride)
      ? {
          avatarOverride: {
            provider: args.avatarOverride.provider.trim() as ModelSelectionProviderName,
            model: args.avatarOverride.model.trim(),
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
    ...(isModelSelectionComplete(args.memoryOverride)
      ? {
          memoryOverride: {
            provider: args.memoryOverride.provider.trim() as ModelSelectionProviderName,
            model: args.memoryOverride.model.trim(),
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
