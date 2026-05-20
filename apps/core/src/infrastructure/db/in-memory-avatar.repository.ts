import type {
  CreateAvatarParams,
  IAvatarRepository,
  UpdateAvatarParams,
} from '../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import { DomainError } from '../../domain/errors.js'
import type { AvatarLlmOverride } from '../../domain/model-config/index.js'

function applyLlmOverride(
  config: Record<string, unknown>,
  llmOverride: AvatarLlmOverride | null | undefined,
): Record<string, unknown> {
  if (llmOverride === undefined) return config

  const nextConfig = { ...config }
  const hasProvider = llmOverride !== null && llmOverride.provider !== undefined
  const hasModel = llmOverride !== null && llmOverride.model !== undefined

  if (llmOverride === null || (!hasProvider && !hasModel)) {
    delete nextConfig['llmOverride']
    return nextConfig
  }

  nextConfig['llmOverride'] = {
    ...(hasProvider ? { provider: llmOverride.provider } : {}),
    ...(hasModel ? { model: llmOverride.model } : {}),
  }
  return nextConfig
}

function buildUpdatedConfig(
  existing: Record<string, unknown>,
  updatesConfig: Record<string, unknown> | undefined,
  updatesLlmOverride: AvatarLlmOverride | null | undefined,
): Record<string, unknown> | undefined {
  if (updatesConfig === undefined && updatesLlmOverride === undefined) return undefined
  return applyLlmOverride(updatesConfig ?? existing, updatesLlmOverride)
}

function buildUpdatedAvatar(
  existing: AvatarConfig,
  updates: UpdateAvatarParams,
  updatedConfig: Record<string, unknown> | undefined,
): AvatarConfig {
  const baseAvatar = startAvatarForUpdate(existing, updates.llmOverride)
  const updated = { ...baseAvatar }
  applyAvatarUpdates(updated, updates, updatedConfig)
  updated.updatedAt = new Date().toISOString()
  return updated
}

function startAvatarForUpdate(
  existing: AvatarConfig,
  llmOverride: AvatarLlmOverride | null | undefined,
): Omit<AvatarConfig, 'updatedAt'> & { updatedAt: string } {
  if (llmOverride !== null) return existing
  const next = { ...existing }
  delete next.llmOverride
  return next
}

function applyAvatarUpdates(
  target: AvatarConfig,
  updates: UpdateAvatarParams,
  updatedConfig: Record<string, unknown> | undefined,
): void {
  if (updates.name !== undefined) target.name = updates.name
  if (updates.personaPrompt !== undefined) target.personaPrompt = updates.personaPrompt
  if (updates.tone !== undefined) target.tone = updates.tone
  if (updates.description !== undefined) target.description = updates.description
  if (updates.adjustments !== undefined) target.adjustments = updates.adjustments
  if (updates.llmOverride !== undefined && updates.llmOverride !== null) {
    target.llmOverride = updates.llmOverride
  }
  if (updatedConfig !== undefined) target.config = updatedConfig
  if (updates.status !== undefined) target.status = updates.status
}

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
      ...(params.llmOverride !== undefined && params.llmOverride !== null
        ? { llmOverride: params.llmOverride }
        : {}),
      config: applyLlmOverride(params.config ?? {}, params.llmOverride),
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
    const updatedConfig = buildUpdatedConfig(existing.config, updates.config, updates.llmOverride)

    const updated = buildUpdatedAvatar(existing, updates, updatedConfig)
    this.avatars.set(avatarId, updated)
    return Promise.resolve(updated)
  }
}
