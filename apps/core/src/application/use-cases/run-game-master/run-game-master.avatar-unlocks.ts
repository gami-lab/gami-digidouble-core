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
  if (session?.unlockedAvatarIds === undefined || output.unlockAvatarIds === undefined) {
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
  const unlockReasonById = new Map(
    (output.unlockDecisions ?? []).map((decision) => [decision.avatarId, decision.reason] as const),
  )
  const evaluations = [...new Set(output.unlockAvatarIds)].reduce<UnlockEvaluation[]>(
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
  const lockedAvatars = avatars.filter(
    (avatar) => avatar.status === 'active' && !session.unlockedAvatarIds?.includes(avatar.avatarId),
  )

  return lockedAvatars.reduce<Set<string>>((ids, avatar) => {
    const avatarName = avatar.name.trim().toLowerCase()
    const avatarId = avatar.avatarId.toLowerCase()
    if (
      (avatarName.length > 0 && messageCorpus.includes(avatarName)) ||
      messageCorpus.includes(avatarId)
    ) {
      ids.add(avatar.avatarId)
    }
    return ids
  }, new Set<string>())
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
