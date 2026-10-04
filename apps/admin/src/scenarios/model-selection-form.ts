import {
  SCENARIO_MODEL_SLOTS,
  type AvatarLlmOverride,
  type ModelProfile,
  type ModelSelectionProviderName,
  type ScenarioModelSelection,
  type ScenarioModelSlot,
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

export type ScenarioModelSelectionFormValue = Record<ScenarioModelSlot, ModelSelectionFormValue>

/** Admin copy and DOM id suffix per scenario slot; iterate this instead of naming slots. */
export const SCENARIO_MODEL_SLOT_FIELDS: Record<
  ScenarioModelSlot,
  { idSuffix: string; label: string; helperText: string; inheritedText: string }
> = {
  defaultProfile: {
    idSuffix: 'default-model',
    label: 'Scenario default model',
    helperText:
      'Fallback for every role without its own override. Also used for one-time avatar trait preparation.',
    inheritedText: 'Inherited from global runtime config.',
  },
  avatarOverride: {
    idSuffix: 'avatar-model',
    label: 'Avatar override',
    helperText:
      'Used for live Avatar conversation turns. Does not affect one-time trait preparation.',
    inheritedText: 'Inherited from scenario default or global Avatar config for live turns.',
  },
  gameMasterOverride: {
    idSuffix: 'gm-model',
    label: 'Game Master override',
    helperText:
      'Used for Game Master turns. Leave empty to inherit the scenario default or global runtime config.',
    inheritedText: 'Inherited from scenario default or global Game Master config.',
  },
  memoryOverride: {
    idSuffix: 'memory-model',
    label: 'Memory override',
    helperText:
      'Used for memory maintenance. Leave empty to inherit the scenario default or global runtime config.',
    inheritedText: 'Inherited from scenario default or global Memory config.',
  },
}

export function fromScenarioModelSelection(
  value: ScenarioModelSelection | undefined,
): ScenarioModelSelectionFormValue {
  return mapSlots((slot) => toFormValue(value?.[slot]))
}

export const EMPTY_SCENARIO_MODEL_SELECTION = fromScenarioModelSelection(undefined)

export function hasPartialScenarioModelSelection(value: ScenarioModelSelectionFormValue): boolean {
  return SCENARIO_MODEL_SLOTS.some((slot) => hasPartialModelSelection(value[slot]))
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

export function toScenarioModelSelection(
  value: ScenarioModelSelectionFormValue,
): ScenarioModelSelection | undefined {
  const next: ScenarioModelSelection = {}
  for (const slot of SCENARIO_MODEL_SLOTS) {
    const field = value[slot]
    if (isModelSelectionComplete(field)) {
      next[slot] = {
        provider: field.provider.trim() as ModelSelectionProviderName,
        model: field.model.trim(),
      }
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function mapSlots<T>(fn: (slot: ScenarioModelSlot) => T): Record<ScenarioModelSlot, T> {
  return Object.fromEntries(SCENARIO_MODEL_SLOTS.map((slot) => [slot, fn(slot)])) as Record<
    ScenarioModelSlot,
    T
  >
}

function toFormValue(profile: ModelProfile | undefined): ModelSelectionFormValue {
  return {
    provider: profile?.provider ?? '',
    model: profile?.model ?? '',
  }
}
