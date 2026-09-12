import type {
  CreateAvatarParams,
  IAvatarRepository,
  UpdateAvatarParams,
} from '../../application/ports/IAvatarRepository.js'
import type { AvatarComputedTraits, AvatarConfig } from '../../domain/avatar/avatar.types.js'
import { DomainError } from '../../domain/errors.js'
import type { AvatarLlmOverride } from '../../domain/model-config/index.js'
import type { VoiceConfiguration } from '@gami/shared'
import {
  applyVoiceConfiguration,
  readVoiceConfiguration,
  withoutVoiceConfiguration,
} from '../../domain/voice/voice-configuration.js'

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
  existing: Record<string, unknown> & { voiceConfig?: VoiceConfiguration },
  existingVoiceConfig: VoiceConfiguration | undefined,
  updatesConfig: Record<string, unknown> | undefined,
  updatesLlmOverride: AvatarLlmOverride | null | undefined,
  updatesVoiceConfig: UpdateAvatarParams['voiceConfig'],
): Record<string, unknown> | undefined {
  if (
    updatesConfig === undefined &&
    updatesLlmOverride === undefined &&
    updatesVoiceConfig === undefined
  )
    return undefined
  const nextVoiceConfig =
    updatesVoiceConfig === undefined
      ? (existingVoiceConfig ?? existing.voiceConfig ?? readVoiceConfiguration(existing))
      : updatesVoiceConfig
  return applyLlmOverride(
    applyVoiceConfiguration(updatesConfig ?? existing, nextVoiceConfig),
    updatesLlmOverride,
  )
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
  applyUpdatedVoiceConfiguration(target, updatedConfig)
  if (updates.status !== undefined) target.status = updates.status
}

function applyUpdatedVoiceConfiguration(
  target: AvatarConfig,
  updatedConfig: Record<string, unknown> | undefined,
): void {
  if (updatedConfig === undefined) return
  const nextVoiceConfig = readVoiceConfiguration(updatedConfig)
  if (nextVoiceConfig !== undefined) target.voiceConfig = nextVoiceConfig
  target.config = withoutVoiceConfiguration(updatedConfig)
  if (nextVoiceConfig === undefined) delete target.voiceConfig
}

function normalizeInitialAvatar(avatar: AvatarConfig): AvatarConfig {
  const voiceConfig = avatar.voiceConfig ?? readVoiceConfiguration(avatar.config)
  return {
    ...avatar,
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    config: withoutVoiceConfiguration(avatar.config),
  }
}

/**
 * In-memory avatar repository for tests and local deterministic flows.
 */
export class InMemoryAvatarRepository implements IAvatarRepository {
  private readonly avatars: Map<string, AvatarConfig>

  constructor(initialData: AvatarConfig[] = []) {
    this.avatars = new Map(
      initialData.map((avatar) => [avatar.avatarId, normalizeInitialAvatar(avatar)]),
    )
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
      ...(params.voiceConfig !== undefined ? { voiceConfig: params.voiceConfig } : {}),
      config: withoutVoiceConfiguration(
        applyLlmOverride(
          applyVoiceConfiguration(params.config ?? {}, params.voiceConfig),
          params.llmOverride,
        ),
      ),
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
    const updatedConfig = buildUpdatedConfig(
      {
        ...existing.config,
        ...(existing.voiceConfig !== undefined ? { voiceConfig: existing.voiceConfig } : {}),
      },
      existing.voiceConfig,
      updates.config,
      updates.llmOverride,
      updates.voiceConfig,
    )

    const updated = buildUpdatedAvatar(existing, updates, updatedConfig)
    this.avatars.set(avatarId, updated)
    return Promise.resolve(updated)
  }

  async saveComputedTraits(
    avatarId: string,
    computedTraits: AvatarComputedTraits | null,
  ): Promise<AvatarConfig> {
    const existing = this.avatars.get(avatarId)
    if (existing === undefined) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }
    const updated = { ...existing, updatedAt: new Date().toISOString() }
    if (computedTraits === null) {
      delete updated.computedTraits
    } else {
      updated.computedTraits = computedTraits
    }
    this.avatars.set(avatarId, updated)
    return Promise.resolve(updated)
  }
}
