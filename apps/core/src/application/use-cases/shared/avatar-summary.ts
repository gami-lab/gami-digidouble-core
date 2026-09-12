import type { AvatarSummary } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

function readAvailabilityKey(config: Record<string, unknown>): string | undefined {
  const availabilityKey = config['availabilityKey']
  if (typeof availabilityKey === 'string' && availabilityKey.length > 0) {
    return availabilityKey
  }

  const legacyRouteKey = config['routeKey']
  if (typeof legacyRouteKey === 'string' && legacyRouteKey.length > 0) {
    return legacyRouteKey
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
    computedTraits: avatar.computedTraits ?? null,
    config: avatar.config,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}
