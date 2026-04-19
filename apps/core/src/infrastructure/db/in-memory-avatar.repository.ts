import type {
  CreateAvatarParams,
  IAvatarRepository,
} from '../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'

/**
 * In-memory avatar repository for tests and local deterministic flows.
 */
export class InMemoryAvatarRepository implements IAvatarRepository {
  private readonly avatars: Map<string, AvatarConfig>

  constructor(initialData: AvatarConfig[] = []) {
    this.avatars = new Map(initialData.map((avatar) => [avatar.avatarId, avatar]))
  }

  create(params: CreateAvatarParams): Promise<AvatarConfig> {
    const avatar: AvatarConfig = {
      avatarId: `avatar_${crypto.randomUUID()}`,
      scenarioId: params.scenarioId,
      name: params.name,
      slug: params.slug,
      status: params.status ?? 'active',
      personaPrompt: params.personaPrompt,
      ...(params.tone !== undefined ? { tone: params.tone } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.adjustments !== undefined ? { adjustments: params.adjustments } : {}),
      ...(params.config !== undefined ? { config: params.config } : {}),
    }

    this.avatars.set(avatar.avatarId, avatar)
    return Promise.resolve(avatar)
  }

  findById(avatarId: string): Promise<AvatarConfig | null> {
    return Promise.resolve(this.avatars.get(avatarId) ?? null)
  }
}
