import type { AvatarSummary, AvailableAvatarSummary } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

function readAvailabilityKey(config: Record<string, unknown>): string | undefined {
  const availabilityKey = config['availabilityKey']
  if (typeof availabilityKey === 'string' && availabilityKey.length > 0) {
    return availabilityKey
  }
  return undefined
}

export function toAvatarSummary(avatar: AvatarConfig): AvatarSummary {
  const availabilityKey = readAvailabilityKey(avatar.config)

  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    ...(avatar.llmOverride !== undefined ? { llmOverride: avatar.llmOverride } : {}),
    ...(avatar.voiceConfig !== undefined ? { voiceConfig: avatar.voiceConfig } : {}),
    ...(availabilityKey !== undefined ? { availabilityKey } : {}),
    ...(avatar.computedTraits !== undefined ? { computedTraits: avatar.computedTraits } : {}),
    config: avatar.config,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}

/** Public player projection; deliberately excludes admin-only Avatar fields. */
export function toAvailableAvatarSummary(avatar: AvatarConfig): AvailableAvatarSummary {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}
