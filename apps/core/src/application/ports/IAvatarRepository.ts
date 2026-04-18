import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'

/** Port: avatar read access for runtime conversation flows. */
export interface IAvatarRepository {
  findById(avatarId: string): Promise<AvatarConfig | null>
}
