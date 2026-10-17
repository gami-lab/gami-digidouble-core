import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { AvatarPromptOptions } from '../../../domain/avatar/persona-prompt.types.js'
import type { ContextEngineInput } from '../../../domain/context/context-engine.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { GameMasterOrchestrationState } from '../../../domain/game-master/game-master.types.js'
import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import { optionalField } from '../../../domain/optional-field.js'

type GmGuidance = NonNullable<AvatarPromptOptions['gmGuidance']>
type RetrievalStatus = GmGuidance['retrievalStatus']

export type AvatarRetrievalOutcome = {
  retrieval: TypedRetrievalResult | undefined
  failed: boolean
}

function hasRetrievedKnowledge(retrieval: TypedRetrievalResult | undefined): boolean {
  if (retrieval === undefined) return false
  return (
    retrieval.avatar_knowledge.length > 0 ||
    retrieval.world.length > 0 ||
    retrieval.media.length > 0
  )
}

/**
 * The Game Master can require evidence for the next reply; when retrieval failed
 * or found nothing, the Avatar is told so instead of answering from nothing.
 */
export function resolveRetrievalStatus(
  orchestration: GameMasterOrchestrationState | undefined,
  outcome: AvatarRetrievalOutcome,
): RetrievalStatus {
  if (orchestration?.retrievalPlan.required !== true) return undefined
  return outcome.failed || !hasRetrievedKnowledge(outcome.retrieval)
    ? 'insufficient_evidence'
    : undefined
}

export function buildAvatarContextExtensions(args: {
  memory: ContextEngineInput['extensions']['memory']
  retrieval: TypedRetrievalResult | undefined
  session: Session
  avatar: AvatarConfig
  userPersona: UserPersona | undefined
  directorNotes: string | undefined
}): ContextEngineInput['extensions'] {
  return {
    memory: args.memory,
    retrieval: args.retrieval,
    ...optionalField('avatarRetrievalOptions', args.session.avatarOptions?.retrieval),
    userPersona: args.userPersona ?? null,
    gmDirective: args.directorNotes ?? null,
    ...optionalField('responseRules', args.avatar.adjustments),
    ...optionalField('avatarTraits', args.avatar.computedTraits),
  }
}

export function buildGmGuidance(
  orchestration: GameMasterOrchestrationState | undefined,
  directorNotes: string | undefined,
  retrievalStatus: RetrievalStatus,
): { gmGuidance?: GmGuidance } {
  if (orchestration === undefined) return {}
  return {
    gmGuidance: {
      mode: orchestration.dialogueControl.mode,
      askFollowUp: orchestration.dialogueControl.askFollowUp,
      ...optionalField('directorNotes', directorNotes),
      ...optionalField('retrievalStatus', retrievalStatus),
    },
  }
}
