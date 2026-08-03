export const MODEL_PROVIDER_NAMES = ['openai', 'anthropic', 'mistral', 'xai', 'null'] as const

export type ModelProviderName = (typeof MODEL_PROVIDER_NAMES)[number]

export const MODEL_SELECTION_PROVIDER_NAMES = ['openai', 'anthropic', 'mistral', 'xai'] as const

export type ModelSelectionProviderName = (typeof MODEL_SELECTION_PROVIDER_NAMES)[number]

export type ModelPresetOption = {
  value: string
  label: string
}

export type ModelProfile = {
  provider: ModelSelectionProviderName
  model: string
}

export type ModelSelectionOverride = {
  provider?: ModelSelectionProviderName
  model?: string
  serviceTier?: 'fast'
}

export type ScenarioModelSelection = {
  defaultProfile?: ModelProfile
  gameMasterOverride?: ModelProfile
  memoryOverride?: ModelProfile
}

const PROVIDER_MODEL_PRESETS: Record<ModelSelectionProviderName, readonly ModelPresetOption[]> = {
  openai: [
    { value: 'gpt-5.6-sol', label: 'gpt-5.6-sol (frontier)' },
    { value: 'gpt-5.6-terra', label: 'gpt-5.6-terra (balanced)' },
    { value: 'gpt-5.6-luna', label: 'gpt-5.6-luna (cost-sensitive)' },
    { value: 'gpt-5.6', label: 'gpt-5.6 (Sol alias)' },
    { value: 'gpt-5.5', label: 'gpt-5.5 (frontier)' },
    { value: 'gpt-5.4', label: 'gpt-5.4 (balanced)' },
    { value: 'gpt-4o', label: 'gpt-4o (fast & cheap)' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (faster & cheaper)' },
    { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini (fast)' },
    { value: 'gpt-5.4-nano', label: 'gpt-5.4-nano (lowest cost)' },
  ],
  anthropic: [
    { value: 'claude-fable-5', label: 'claude-fable-5 (frontier)' },
    { value: 'claude-opus-5', label: 'claude-opus-5 (most capable)' },
    { value: 'claude-opus-4-8', label: 'claude-opus-4-8 (frontier)' },
    { value: 'claude-opus-4-7', label: 'claude-opus-4-7 (most capable)' },
    { value: 'claude-opus-4-6', label: 'claude-opus-4-6 (long context)' },
    { value: 'claude-opus-4-5-20251101', label: 'claude-opus-4-5-20251101 (pinned)' },
    { value: 'claude-sonnet-5', label: 'claude-sonnet-5 (balanced)' },
    { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 (balanced)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'claude-sonnet-4-5-20250929 (pinned)' },
    { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5 (fastest alias)' },
    { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001 (pinned)' },
  ],
  mistral: [
    { value: 'mistral-medium-3.5', label: 'mistral-medium-3.5 (frontier)' },
    { value: 'mistral-small-4', label: 'mistral-small-4 (efficient)' },
    { value: 'mistral-large-3', label: 'mistral-large-3 (high quality)' },
    { value: 'ministral-3b', label: 'ministral-3b (tiny)' },
  ],
  xai: [
    { value: 'grok-4.3', label: 'grok-4.3 (chat)' },
    { value: 'grok-4.3-latest', label: 'grok-4.3-latest (latest alias)' },
    { value: 'grok-build-0.1', label: 'grok-build-0.1 (coding)' },
  ],
}

function includeCurrentModelIfMissing(
  options: readonly ModelPresetOption[],
  model: string,
): ModelPresetOption[] {
  const normalizedModel = model.trim()
  if (normalizedModel.length === 0) return [...options]
  if (options.some((option) => option.value === normalizedModel)) return [...options]
  return [{ value: normalizedModel, label: `custom / ${normalizedModel}` }, ...options]
}

function normalizePreset(
  provider: ModelSelectionProviderName,
  preset: ModelPresetOption,
): ModelPresetOption {
  return {
    value: preset.value,
    label: `${provider} / ${preset.label}`,
  }
}

export function isModelProviderName(value: string): value is ModelProviderName {
  return MODEL_PROVIDER_NAMES.includes(value as ModelProviderName)
}

export function isModelSelectionProviderName(value: string): value is ModelSelectionProviderName {
  return MODEL_SELECTION_PROVIDER_NAMES.includes(value as ModelSelectionProviderName)
}

export function isAllowedModelForProvider(
  provider: ModelSelectionProviderName,
  model: string,
): boolean {
  return PROVIDER_MODEL_PRESETS[provider].some((preset) => preset.value === model.trim())
}

export function getModelPresetOptions(provider: string, model: string): ModelPresetOption[] {
  if (isModelSelectionProviderName(provider)) {
    return includeCurrentModelIfMissing(PROVIDER_MODEL_PRESETS[provider], model)
  }

  if (provider === 'null') {
    return includeCurrentModelIfMissing([], model)
  }

  const flattened = MODEL_SELECTION_PROVIDER_NAMES.flatMap((name) =>
    PROVIDER_MODEL_PRESETS[name].map((preset) => normalizePreset(name, preset)),
  )
  return includeCurrentModelIfMissing(flattened, model)
}
