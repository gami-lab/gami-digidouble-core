import type { AvatarComputedTraits, AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { AvatarLlmOverride } from '../../domain/model-config/index.js'

/** Port: avatar read/write access for runtime conversation flows. */
export interface IAvatarRepository {
  create(params: CreateAvatarParams): Promise<AvatarConfig>
  findById(avatarId: string): Promise<AvatarConfig | null>
  listByScenarioId(scenarioId: string): Promise<AvatarConfig[]>
  delete(avatarId: string): Promise<void>
  update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig>
  /**
   * Narrow write path for derived trait preparation (EPIC 8.1). Deliberately
   * separate from `update` so trait writes never ride along with generic
   * author-input mutation payloads. Pass `null` to clear.
   */
  saveComputedTraits(
    avatarId: string,
    computedTraits: AvatarComputedTraits | null,
  ): Promise<AvatarConfig>
}

export interface CreateAvatarParams {
  scenarioId: string
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
}

export type UpdateAvatarParams = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
}
