import type { AvatarLlmOverride } from './entity-types.js'
import type { ModelProviderName, ModelSelectionProviderName } from './model-catalog.js'
import type { UpdateModelConfigRequest } from './runtime-inspector-types.js'

export type ModelConfigFormValue = {
  provider: string
  model: string
}

export type ModelConfigFormInput = {
  globalDefault: ModelConfigFormValue
  roleOverrides: {
    avatar: ModelConfigFormValue
    gameMaster: ModelConfigFormValue
    memory: ModelConfigFormValue
  }
}

export function mapModelConfigFormToRequest(form: ModelConfigFormInput): UpdateModelConfigRequest {
  const roleOverrides: NonNullable<UpdateModelConfigRequest['roleOverrides']> = {}
  const avatarOverride = normalizeModelConfigOverride(form.roleOverrides.avatar)
  const gameMasterOverride = normalizeModelConfigOverride(form.roleOverrides.gameMaster)
  const memoryOverride = normalizeModelConfigOverride(form.roleOverrides.memory)

  if (avatarOverride !== undefined) roleOverrides.avatar = avatarOverride
  if (gameMasterOverride !== undefined) roleOverrides.gameMaster = gameMasterOverride
  if (memoryOverride !== undefined) roleOverrides.memory = memoryOverride

  return {
    globalDefault: {
      provider: form.globalDefault.provider as ModelProviderName,
      model: form.globalDefault.model,
    },
    roleOverrides,
  }
}

function normalizeModelConfigOverride(
  override: ModelConfigFormValue,
): { provider?: ModelProviderName; model?: string } | undefined {
  const provider = override.provider.trim()
  const model = override.model.trim()
  if (provider.length === 0 && model.length === 0) return undefined

  return {
    ...(provider.length > 0 ? { provider: provider as ModelProviderName } : {}),
    ...(model.length > 0 ? { model } : {}),
  }
}

export function mapAvatarOverride(value: ModelConfigFormValue): AvatarLlmOverride | null {
  const provider = value.provider.trim()
  const model = value.model.trim()
  if (provider.length === 0 && model.length === 0) return null

  return {
    provider: provider as ModelSelectionProviderName,
    model,
  }
}
