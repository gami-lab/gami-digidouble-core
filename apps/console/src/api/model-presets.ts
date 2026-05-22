import { PROVIDER_OPTIONS } from './provider-options'

type ModelPreset = {
  value: string
  label: string
}

const PROVIDER_MODEL_PRESETS: Record<(typeof PROVIDER_OPTIONS)[number], ModelPreset[]> = {
  // Source: https://developers.openai.com/api/docs/models
  openai: [
    { value: 'gpt-5.5', label: 'gpt-5.5 (frontier)' },
    { value: 'gpt-5.4', label: 'gpt-5.4 (balanced)' },
    { value: 'gpt-4o', label: 'gpt-4o (fast & cheap)' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (faster & cheaper)' },
    { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini (fast)' },
    { value: 'gpt-5.4-nano', label: 'gpt-5.4-nano (lowest cost)' },
  ],
  // Source: https://platform.claude.com/docs/en/docs/about-claude/models
  anthropic: [
    { value: 'claude-opus-4-7', label: 'claude-opus-4-7 (most capable)' },
    { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 (balanced)' },
    { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5 (fastest alias)' },
    { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5-20251001 (pinned)' },
  ],
  // Source: https://docs.mistral.ai/getting-started/models/models_overview/
  mistral: [
    { value: 'mistral-medium-3.5', label: 'mistral-medium-3.5 (frontier)' },
    { value: 'mistral-small-4', label: 'mistral-small-4 (efficient)' },
    { value: 'mistral-large-3', label: 'mistral-large-3 (high quality)' },
    { value: 'ministral-3b', label: 'ministral-3b (tiny)' },
  ],
  // Source: https://docs.x.ai/developers/models
  xai: [
    { value: 'grok-4.3', label: 'grok-4.3 (chat)' },
    { value: 'grok-4.3-latest', label: 'grok-4.3-latest (latest alias)' },
    { value: 'grok-build-0.1', label: 'grok-build-0.1 (coding)' },
  ],
  null: [],
}

function normalizePreset(preset: ModelPreset, provider: string): ModelPreset {
  return {
    value: preset.value,
    label: `${provider} / ${preset.label}`,
  }
}

function includeCurrentModelIfMissing(options: ModelPreset[], model: string): ModelPreset[] {
  const nextModel = model.trim()
  if (nextModel.length === 0) return options
  if (options.some((option) => option.value === nextModel)) return options
  return [{ value: nextModel, label: `custom / ${nextModel}` }, ...options]
}

export function getModelPresetOptions(provider: string, model: string): ModelPreset[] {
  if (provider.length > 0) {
    const entries = PROVIDER_MODEL_PRESETS[provider as (typeof PROVIDER_OPTIONS)[number]]
    return includeCurrentModelIfMissing(entries, model)
  }

  const flattened = PROVIDER_OPTIONS.filter((name) => name !== 'null').flatMap((name) => {
    const entries = PROVIDER_MODEL_PRESETS[name]
    return entries.map((entry) => normalizePreset(entry, name))
  })

  return includeCurrentModelIfMissing(flattened, model)
}
