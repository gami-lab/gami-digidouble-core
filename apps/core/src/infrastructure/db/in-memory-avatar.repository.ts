import type {
  CreateAvatarParams,
  IAvatarRepository,
  UpdateAvatarParams,
} from '../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import { DomainError } from '../../domain/errors.js'

/**
 * In-memory avatar repository for tests and local deterministic flows.
 */
export class InMemoryAvatarRepository implements IAvatarRepository {
  private readonly avatars: Map<string, AvatarConfig>

  constructor(initialData: AvatarConfig[] = []) {
    this.avatars = new Map(initialData.map((avatar) => [avatar.avatarId, avatar]))
  }

  create(params: CreateAvatarParams): Promise<AvatarConfig> {
    const now = new Date().toISOString()
    const avatar: AvatarConfig = {
      avatarId: `avatar_${crypto.randomUUID()}`,
      scenarioId: params.scenarioId,
      name: params.name,
      status: params.status ?? 'active',
      personaPrompt: params.personaPrompt,
      ...(params.tone !== undefined ? { tone: params.tone } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.adjustments !== undefined ? { adjustments: params.adjustments } : {}),
      config: params.config ?? {},
      ...(params.availabilityKey !== undefined ? { availabilityKey: params.availabilityKey } : {}),
      createdAt: now,
      updatedAt: now,
    }

    this.avatars.set(avatar.avatarId, avatar)
    return Promise.resolve(avatar)
  }

  findById(avatarId: string): Promise<AvatarConfig | null> {
    return Promise.resolve(this.avatars.get(avatarId) ?? null)
  }

  listByScenarioId(scenarioId: string): Promise<AvatarConfig[]> {
    const avatars = [...this.avatars.values()]
      .filter((avatar) => avatar.scenarioId === scenarioId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return Promise.resolve(avatars)
  }

  delete(avatarId: string): Promise<void> {
    this.avatars.delete(avatarId)
    return Promise.resolve()
  }

  async update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig> {
    const existing = this.avatars.get(avatarId)
    if (existing === undefined) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }
    const updated: AvatarConfig = {
      ...existing,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.personaPrompt !== undefined ? { personaPrompt: updates.personaPrompt } : {}),
      ...(updates.tone !== undefined ? { tone: updates.tone } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.adjustments !== undefined ? { adjustments: updates.adjustments } : {}),
      ...(updates.config !== undefined ? { config: updates.config } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.availabilityKey !== undefined
        ? { availabilityKey: updates.availabilityKey }
        : {}),
      updatedAt: new Date().toISOString(),
    }
    this.avatars.set(avatarId, updated)
    return Promise.resolve(updated)
  }
}
