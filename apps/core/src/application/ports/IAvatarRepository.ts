import type { CreateAvatarRequest, UpdateAvatarRequest } from '@gami/shared'
import type { AvatarComputedTraits, AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { AvatarLlmOverride } from '../../domain/model-config/index.js'

export interface IAvatarRepository {
  create(params: CreateAvatarParams): Promise<AvatarConfig>
  findById(avatarId: string): Promise<AvatarConfig | null>
  listByScenarioId(scenarioId: string): Promise<AvatarConfig[]>
  delete(avatarId: string): Promise<void>
  update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig>
  /** Keeps derived trait writes separate from author-input mutations. */
  saveComputedTraits(avatarId: string, computedTraits: AvatarComputedTraits): Promise<AvatarConfig>
}

export type CreateAvatarParams = CreateAvatarRequest & {
  scenarioId: string
}

export type UpdateAvatarParams = UpdateAvatarRequest & {
  llmOverride?: AvatarLlmOverride | null
}
