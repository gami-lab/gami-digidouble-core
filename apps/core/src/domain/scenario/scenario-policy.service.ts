import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { ScenarioConfig, ScenarioAvatarAvailabilityConfig } from './scenario.types.js'

export function resolveInitialUnlockedAvatarIds(
  config: ScenarioConfig,
  avatars: AvatarConfig[],
): string[] | undefined {
  const availability = extractAvatarAvailability(config)
  if (availability?.initialAvatarIds === undefined) return undefined

  return filterExistingAvatarIds(availability.initialAvatarIds, avatars)
}

function extractAvatarAvailability(
  config: ScenarioConfig,
): ScenarioAvatarAvailabilityConfig | null {
  if (!isRecord(config.avatarAvailability)) return null

  const initialAvatarIds = Array.isArray(config.avatarAvailability['initialAvatarIds'])
    ? config.avatarAvailability['initialAvatarIds'].filter(hasText)
    : []
  const unlockableAvatarIds = Array.isArray(config.avatarAvailability['unlockableAvatarIds'])
    ? config.avatarAvailability['unlockableAvatarIds'].filter(hasText)
    : undefined

  return {
    initialAvatarIds,
    ...(unlockableAvatarIds !== undefined ? { unlockableAvatarIds } : {}),
  }
}

function filterExistingAvatarIds(avatarIds: string[], avatars: AvatarConfig[]): string[] {
  const existingAvatarIds = new Set(avatars.map((avatar) => avatar.avatarId))
  return avatarIds.reduce<string[]>((resolvedAvatarIds, avatarId) => {
    if (existingAvatarIds.has(avatarId)) {
      resolvedAvatarIds.push(avatarId)
    }
    return resolvedAvatarIds
  }, [])
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
