export type ModelRole = 'avatar' | 'gameMaster' | 'memory'

export const PROVIDER_NAMES = ['openai', 'anthropic', 'mistral', 'xai', 'null'] as const

export type ProviderName = (typeof PROVIDER_NAMES)[number]

export interface ModelOverride {
  provider?: ProviderName
  model?: string
}

export type RoleOverrides = Partial<Record<ModelRole, ModelOverride>>

export interface ModelConfig {
  globalDefault: {
    provider: ProviderName
    model: string
  }
  roleOverrides: RoleOverrides
  updatedAt: string
}

export type AvatarLlmOverride = ModelOverride

export function isProviderName(value: string): value is ProviderName {
  return PROVIDER_NAMES.includes(value as ProviderName)
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  globalDefault: { provider: 'null', model: '' },
  roleOverrides: {},
  updatedAt: new Date(0).toISOString(),
}
