import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'

/** Port: avatar read/write access for runtime conversation flows. */
export interface IAvatarRepository {
  create(params: CreateAvatarParams): Promise<AvatarConfig>
  findById(avatarId: string): Promise<AvatarConfig | null>
  listByScenarioId(scenarioId: string): Promise<AvatarConfig[]>
  delete(avatarId: string): Promise<void>
  update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig>
}

export interface CreateAvatarParams {
  scenarioId: string
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
  availabilityKey?: string
}

export type UpdateAvatarParams = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
  availabilityKey?: string
}
