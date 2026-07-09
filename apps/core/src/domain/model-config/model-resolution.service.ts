import type {
  AvatarLlmOverride,
  ModelConfig,
  ModelRole,
  ProviderName,
  ScenarioModelSelectionConfig,
} from './model-config.types.js'

function resolveBaseProvider(role: ModelRole, config: ModelConfig): ProviderName {
  const roleProvider = config.roleOverrides[role]?.provider
  return roleProvider ?? config.globalDefault.provider
}

function resolveBaseModel(role: ModelRole, config: ModelConfig): string {
  const roleModel = config.roleOverrides[role]?.model
  return roleModel ?? config.globalDefault.model
}

function resolveScenarioSelection(
  role: ModelRole,
  scenarioModelSelection: ScenarioModelSelectionConfig | undefined,
): ScenarioModelSelectionConfig['defaultProfile'] | undefined {
  if (role === 'memory' || scenarioModelSelection === undefined) return undefined
  if (role === 'gameMaster') {
    return scenarioModelSelection.gameMasterOverride ?? scenarioModelSelection.defaultProfile
  }

  return scenarioModelSelection.defaultProfile
}

function resolveAvatarOverrideProvider(
  role: ModelRole,
  avatarOverride: AvatarLlmOverride | undefined,
): ProviderName | undefined {
  return role === 'avatar' ? avatarOverride?.provider : undefined
}

function resolveAvatarOverrideModel(
  role: ModelRole,
  avatarOverride: AvatarLlmOverride | undefined,
): string | undefined {
  return role === 'avatar' ? avatarOverride?.model : undefined
}

function resolve(
  role: ModelRole,
  config: ModelConfig,
  options?: {
    avatarOverride?: AvatarLlmOverride
    scenarioModelSelection?: ScenarioModelSelectionConfig
  },
): { provider: ProviderName; model: string } {
  const baseProvider = resolveBaseProvider(role, config)
  const baseModel = resolveBaseModel(role, config)
  const scenarioSelection = resolveScenarioSelection(role, options?.scenarioModelSelection)
  const avatarProvider = resolveAvatarOverrideProvider(role, options?.avatarOverride)
  const avatarModel = resolveAvatarOverrideModel(role, options?.avatarOverride)

  return {
    provider: avatarProvider ?? scenarioSelection?.provider ?? baseProvider,
    model: avatarModel ?? scenarioSelection?.model ?? baseModel,
  }
}

export const ModelResolutionService = {
  resolve,
}
