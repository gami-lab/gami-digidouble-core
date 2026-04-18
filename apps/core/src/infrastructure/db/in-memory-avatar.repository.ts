import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'

/**
 * In-memory avatar repository for tests and local deterministic flows.
 */
export class InMemoryAvatarRepository implements IAvatarRepository {
  private readonly avatars: Map<string, AvatarConfig>

  constructor(initialData: AvatarConfig[] = []) {
    this.avatars = new Map(initialData.map((avatar) => [avatar.avatarId, avatar]))
  }

  findById(avatarId: string): Promise<AvatarConfig | null> {
    return Promise.resolve(this.avatars.get(avatarId) ?? null)
  }
}
