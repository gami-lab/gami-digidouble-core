import type { AvatarSummary, AvailableAvatarSummary, PublicAvatarPresentation } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { readPresentation, withoutPresentation } from '../../../domain/presentation/presentation.js'

function readAvailabilityKey(config: Record<string, unknown>): string | undefined {
  const availabilityKey = config['availabilityKey']
  if (typeof availabilityKey === 'string' && availabilityKey.length > 0) {
    return availabilityKey
  }
  return undefined
}

export function toAvatarSummary(avatar: AvatarConfig): AvatarSummary {
  const availabilityKey = readAvailabilityKey(avatar.config)
  const presentation = readPresentation('avatar', avatar.config)

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
    ...(presentation !== undefined ? { presentation } : {}),
    ...(availabilityKey !== undefined ? { availabilityKey } : {}),
    ...(avatar.computedTraits !== undefined ? { computedTraits: avatar.computedTraits } : {}),
    config: withoutPresentation(avatar.config),
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}

/** Public player projection; deliberately excludes admin-only Avatar fields. */
export function toAvailableAvatarSummary(
  avatar: AvatarConfig,
  presentation: PublicAvatarPresentation | undefined,
): AvailableAvatarSummary {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(presentation !== undefined ? { presentation } : {}),
  }
}
