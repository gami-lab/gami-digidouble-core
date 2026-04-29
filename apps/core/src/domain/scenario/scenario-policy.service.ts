import type { AvatarConfig } from '../avatar/avatar.types.js'
import type {
  ScenarioConfig,
  ScenarioAvatarAvailabilityConfig,
  ScenarioTopicSignal,
} from './scenario.types.js'

export type CompetenceRedirect = {
  topicId: string
  message: string
}

export function classifyScenarioTopic(message: string, config: ScenarioConfig): string | null {
  const normalizedMessage = normalizeText(message)
  if (normalizedMessage.length === 0) return null

  for (const signal of extractTopicSignals(config)) {
    if (signal.keywords.some((keyword) => normalizedMessage.includes(normalizeText(keyword)))) {
      return signal.topicId
    }
  }

  return null
}

export function resolveInitialUnlockedAvatarIds(
  config: ScenarioConfig,
  avatars: AvatarConfig[],
): string[] | undefined {
  const availability = extractAvatarAvailability(config)
  if (availability?.initialAvatarKeys === undefined) return undefined

  return mapAvatarKeysToIds(availability.initialAvatarKeys, avatars)
}

export function resolveCompetenceRedirect(
  avatar: AvatarConfig,
  topicId: string | null,
): CompetenceRedirect | null {
  if (topicId === null) return null

  const boundary = extractCompetenceBoundary(avatar)
  if (boundary === null) return null
  if (boundary.allowedTopicIds.length === 0 || boundary.allowedTopicIds.includes(topicId)) {
    return null
  }

  return boundary.redirects.find((redirect) => redirect.topicId === topicId) ?? null
}

export function extractAvatarRouteKey(avatar: AvatarConfig): string | null {
  const routeKey = avatar.config['routeKey']
  return hasText(routeKey) ? routeKey.trim() : null
}

type AvatarCompetenceBoundary = {
  allowedTopicIds: string[]
  redirects: CompetenceRedirect[]
}

function extractTopicSignals(config: ScenarioConfig): ScenarioTopicSignal[] {
  if (!Array.isArray(config.topicSignals)) return []

  return config.topicSignals.filter(
    (signal): signal is ScenarioTopicSignal =>
      isRecord(signal) &&
      hasText(signal['topicId']) &&
      Array.isArray(signal['keywords']) &&
      signal['keywords'].every((keyword) => hasText(keyword)),
  )
}

function extractAvatarAvailability(
  config: ScenarioConfig,
): ScenarioAvatarAvailabilityConfig | null {
  if (!isRecord(config.avatarAvailability)) return null

  const initialAvatarKeys = Array.isArray(config.avatarAvailability['initialAvatarKeys'])
    ? config.avatarAvailability['initialAvatarKeys'].filter(hasText)
    : undefined
  const unlockableAvatarKeys = Array.isArray(config.avatarAvailability['unlockableAvatarKeys'])
    ? config.avatarAvailability['unlockableAvatarKeys'].filter(hasText)
    : undefined

  return {
    ...(initialAvatarKeys !== undefined ? { initialAvatarKeys } : {}),
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

function extractCompetenceBoundary(avatar: AvatarConfig): AvatarCompetenceBoundary | null {
  const boundary = avatar.config['competenceBoundary']
  if (!isRecord(boundary)) return null

  const allowedTopicIds = Array.isArray(boundary['allowedTopicIds'])
    ? boundary['allowedTopicIds'].filter(hasText)
    : []
  const redirects = Array.isArray(boundary['redirects'])
    ? boundary['redirects'].filter(
        (redirect): redirect is CompetenceRedirect =>
          isRecord(redirect) && hasText(redirect['topicId']) && hasText(redirect['message']),
      )
    : []

  if (allowedTopicIds.length === 0 && redirects.length === 0) return null

  return {
    allowedTopicIds,
    redirects,
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
