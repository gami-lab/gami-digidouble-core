import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { ScenarioConfig, ScenarioAvatarAvailabilityConfig } from './scenario.types.js'

export function resolveInitialUnlockedAvatarIds(
  config: ScenarioConfig,
  avatars: AvatarConfig[],
): string[] | undefined {
  const availability = extractAvatarAvailability(config)
  if (availability?.initialAvatarKeys === undefined) return undefined

  return mapAvatarKeysToIds(availability.initialAvatarKeys, avatars)
}

export function extractAvatarRouteKey(avatar: AvatarConfig): string | null {
  return hasText(avatar.availabilityKey) ? avatar.availabilityKey.trim() : null
}

function extractAvatarAvailability(
  config: ScenarioConfig,
): ScenarioAvatarAvailabilityConfig | null {
  if (!isRecord(config.avatarAvailability)) return null

  const initialAvatarKeys = Array.isArray(config.avatarAvailability['initialAvatarKeys'])
    ? config.avatarAvailability['initialAvatarKeys'].filter(hasText)
    : []
  const unlockableAvatarKeys = Array.isArray(config.avatarAvailability['unlockableAvatarKeys'])
    ? config.avatarAvailability['unlockableAvatarKeys'].filter(hasText)
    : undefined

  return {
    initialAvatarKeys,
    ...(unlockableAvatarKeys !== undefined ? { unlockableAvatarKeys } : {}),
  }
}

function extractAvatarRouteIdentities(avatars: AvatarConfig[]): Map<string, string> {
  return avatars.reduce<Map<string, string>>((identities, avatar) => {
    const routeKey = extractAvatarRouteKey(avatar)
    if (routeKey !== null) {
      identities.set(routeKey, avatar.avatarId)
    }
    return identities
  }, new Map())
}

function mapAvatarKeysToIds(avatarKeys: string[], avatars: AvatarConfig[]): string[] {
  const routeIdentities = extractAvatarRouteIdentities(avatars)
  return avatarKeys.reduce<string[]>((avatarIds, avatarKey) => {
    const avatarId = routeIdentities.get(avatarKey)
    if (avatarId !== undefined) {
      avatarIds.push(avatarId)
    }
    return avatarIds
  }, [])
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
