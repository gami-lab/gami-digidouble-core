import type {
  AvatarLlmOverride,
  ModelConfig,
  ModelRole,
  ProviderName,
} from './model-config.types.js'

function resolveProvider(
  role: ModelRole,
  config: ModelConfig,
  avatarOverride?: AvatarLlmOverride,
): ProviderName {
  const roleProvider = config.roleOverrides[role]?.provider
  if (role !== 'avatar') return roleProvider ?? config.globalDefault.provider

  const avatarProvider = avatarOverride?.provider
  return avatarProvider ?? roleProvider ?? config.globalDefault.provider
}

function resolveModel(
  role: ModelRole,
  config: ModelConfig,
  avatarOverride?: AvatarLlmOverride,
): string {
  const roleModel = config.roleOverrides[role]?.model
  if (role !== 'avatar') return roleModel ?? config.globalDefault.model

  const avatarModel = avatarOverride?.model
  return avatarModel ?? roleModel ?? config.globalDefault.model
}

function resolve(
  role: ModelRole,
  config: ModelConfig,
  avatarOverride?: AvatarLlmOverride,
): { provider: ProviderName; model: string } {
  return {
    provider: resolveProvider(role, config, avatarOverride),
    model: resolveModel(role, config, avatarOverride),
  }
}

export const ModelResolutionService = {
  resolve,
}
