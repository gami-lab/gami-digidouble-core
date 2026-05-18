export type ModelRole = 'avatar' | 'gameMaster' | 'memory'

export type ProviderName = 'openai' | 'anthropic' | 'mistral' | 'xai' | 'null'

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
  switch (value) {
    case 'openai':
    case 'anthropic':
    case 'mistral':
    case 'xai':
    case 'null':
      return true
    default:
      return false
  }
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  globalDefault: { provider: 'null', model: '' },
  roleOverrides: {},
  updatedAt: new Date(0).toISOString(),
}
