import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type {
  GameMasterInput,
  GameMasterOutput,
} from '../../../domain/game-master/game-master.types.js'

export type UnlockEvaluation = {
  avatarId: string
  avatarName: string
  reason?: string
  outcome: 'unlocked' | 'already_unlocked' | 'rejected_not_mentioned'
}

export function toGameMasterAvailableAvatars(
  avatars: AvatarConfig[],
  session: Session | null,
): GameMasterInput['context']['availableAvatars'] {
  return avatars
    .filter((avatar) => avatar.status === 'active')
    .map((avatar) => toAvailableAvatar(avatar, session))
}

/** Routing carries either a single unlock target (avatarId/reason) or multiple (unlockDecisions). */
function deriveUnlockCandidates(routing: GameMasterOutput['routing']): {
  avatarIds: string[]
  reasonById: Map<string, string>
} {
  if (
    routing === undefined ||
    (routing.action !== 'unlock' && routing.action !== 'unlock_and_switch')
  ) {
    return { avatarIds: [], reasonById: new Map() }
  }

  const reasonById = new Map<string, string>(
    (routing.unlockDecisions ?? []).map(
      (decision) => [decision.avatarId, decision.reason] as const,
    ),
  )
  const avatarIds = (routing.unlockDecisions ?? []).map((decision) => decision.avatarId)
  if (routing.avatarId !== undefined) {
    avatarIds.push(routing.avatarId)
    if (routing.reason !== undefined && !reasonById.has(routing.avatarId)) {
      reasonById.set(routing.avatarId, routing.reason)
    }
  }

  return { avatarIds: [...new Set(avatarIds)], reasonById }
}

export function resolveAvatarUnlocks(
  session: Session | null,
  avatars: AvatarConfig[],
  output: GameMasterOutput,
  recentMessages: GameMasterInput['recentMessages'] = [],
): {
  nextUnlockedAvatarIds: string[]
  newlyUnlockedAvatarIds: string[]
  evaluations: UnlockEvaluation[]
} | null {
  const { avatarIds: unlockAvatarIds, reasonById: unlockReasonById } = deriveUnlockCandidates(
    output.routing,
  )
  if (session?.unlockedAvatarIds === undefined || unlockAvatarIds.length === 0) {
    return null
  }

  const activeAvatarIds = new Set(
    avatars.filter((avatar) => avatar.status === 'active').map((avatar) => avatar.avatarId),
  )
  const activeAvatarNameById = new Map(
    avatars
      .filter((avatar) => avatar.status === 'active')
      .map((avatar) => [avatar.avatarId, avatar.name] as const),
  )
  const knownUnlockedIds = new Set(session.unlockedAvatarIds)
  const mentionedLockedAvatarIds = resolveMentionedLockedAvatarIds(session, avatars, recentMessages)
  const evaluations = [...new Set(unlockAvatarIds)].reduce<UnlockEvaluation[]>(
    (result, avatarId) => {
      if (!activeAvatarIds.has(avatarId)) return result
      const avatarName = activeAvatarNameById.get(avatarId) ?? avatarId
      const reason = unlockReasonById.get(avatarId)

      if (knownUnlockedIds.has(avatarId)) {
        result.push({
          avatarId,
          avatarName,
          ...(reason !== undefined ? { reason } : {}),
          outcome: 'already_unlocked',
        })
        return result
      }

      if (!mentionedLockedAvatarIds.has(avatarId)) {
        result.push({
          avatarId,
          avatarName,
          ...(reason !== undefined ? { reason } : {}),
          outcome: 'rejected_not_mentioned',
        })
        return result
      }

      result.push({
        avatarId,
        avatarName,
        ...(reason !== undefined ? { reason } : {}),
        outcome: 'unlocked',
      })
      return result
    },
    [],
  )
  const newlyUnlockedAvatarIds = evaluations
    .filter((evaluation) => evaluation.outcome === 'unlocked')
    .map((evaluation) => evaluation.avatarId)

  if (evaluations.length === 0) return null

  return {
    nextUnlockedAvatarIds: [...session.unlockedAvatarIds, ...newlyUnlockedAvatarIds],
    newlyUnlockedAvatarIds,
    evaluations,
  }
}

function resolveMentionedLockedAvatarIds(
  session: Session,
  avatars: AvatarConfig[],
  recentMessages: GameMasterInput['recentMessages'],
): Set<string> {
  const recentMessageList = recentMessages ?? []
  const messageCorpus = recentMessageList.map((message) => message.content.toLowerCase()).join('\n')
  const normalizedCorpus = normalizeText(messageCorpus)
  const corpusTokens = new Set(tokenizeText(messageCorpus))
  const lockedAvatars = avatars.filter(
    (avatar) => avatar.status === 'active' && !session.unlockedAvatarIds?.includes(avatar.avatarId),
  )

  return lockedAvatars.reduce<Set<string>>((ids, avatar) => {
    const avatarName = avatar.name.trim().toLowerCase()
    const avatarId = avatar.avatarId.toLowerCase()
    if (isAvatarMentioned(avatarName, avatarId, messageCorpus, normalizedCorpus, corpusTokens)) {
      ids.add(avatar.avatarId)
    }
    return ids
  }, new Set<string>())
}

function isAvatarMentioned(
  avatarName: string,
  avatarId: string,
  rawCorpus: string,
  normalizedCorpus: string,
  corpusTokens: Set<string>,
): boolean {
  if (avatarId.length > 0 && rawCorpus.includes(avatarId)) return true

  const normalizedAvatarName = normalizeText(avatarName)
  if (normalizedAvatarName.length > 0 && normalizedCorpus.includes(normalizedAvatarName)) {
    return true
  }

  const significantNameTokens = tokenizeText(avatarName).filter(
    (token) => token.length >= 4 && !NAME_TOKEN_STOPWORDS.has(token),
  )
  return significantNameTokens.some((token) => corpusTokens.has(token))
}

const NAME_TOKEN_STOPWORDS = new Set(['miss', 'mrs', 'mr', 'ms', 'dr', 'sir', 'lady', 'lord'])

function normalizeText(value: string): string {
  return tokenizeText(value).join(' ')
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function toAvailableAvatar(
  avatar: AvatarConfig,
  session: Session | null,
): GameMasterInput['context']['availableAvatars'][number] {
  return {
    avatarId: avatar.avatarId,
    name: avatar.name,
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...extractScope(avatar.config),
    ...buildAvailability(session, avatar.avatarId),
  }
}

function extractScope(config: Record<string, unknown>): { scope?: string } {
  const scope = config['scope']
  return typeof scope === 'string' && scope.trim().length > 0 ? { scope: scope.trim() } : {}
}

function buildAvailability(
  session: Session | null,
  avatarId: string,
): { availability?: 'available' | 'locked' } {
  if (session?.unlockedAvatarIds === undefined) return {}
  return {
    availability: session.unlockedAvatarIds.includes(avatarId) ? 'available' : 'locked',
  }
}
