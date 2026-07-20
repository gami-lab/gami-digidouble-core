import type {
  RecordedAvatarContextKnowledgeInjection,
  RecordedAvatarContextSnapshot,
  RecordedGmContextSnapshot,
  RecordedKnowledgeReferenceDto,
  RecordedTypedKnowledgeSections,
} from '@gami/shared'
import type {
  AvatarContextSnapshot,
  GmContextSnapshot,
} from '../../domain/context/session-context.types.js'
import type { RetrievedKnowledgeItem } from '../../domain/knowledge/knowledge.types.js'

type AvatarTypedSections = NonNullable<
  NonNullable<NonNullable<AvatarContextSnapshot['sections']['retrievedContext']>['typedSections']>
>

export function toRecordedAvatarContextSnapshot(
  snapshot: AvatarContextSnapshot,
): RecordedAvatarContextSnapshot {
  const knowledge = toRecordedAvatarKnowledge(snapshot.sections.retrievedContext)

  return {
    ...(snapshot.avatarId !== undefined ? { avatarId: snapshot.avatarId } : {}),
    recentExchanges: snapshot.sections.conversationState.recentExchanges,
    workingMemory: snapshot.sections.conversationState.workingMemory,
    longTermFacts: snapshot.sections.conversationState.longTermFacts,
    ...(knowledge !== undefined ? { knowledge } : {}),
    userPersona: snapshot.sections.userPersona,
    gmNotes: snapshot.sections.directorNotes,
    scenario: snapshot.sections.worldContext,
  }
}

export function toRecordedGmContextSnapshot(
  snapshot: GmContextSnapshot,
): RecordedGmContextSnapshot {
  const knowledge = toRecordedTypedKnowledgeSections(snapshot.sections.retrievedContext)

  return {
    recentMessages: snapshot.sections.conversationState.recentMessages,
    memory: snapshot.sections.conversationState.memory,
    ...(knowledge !== undefined ? { knowledge } : {}),
    currentState: snapshot.currentState,
    availableAvatars: snapshot.availableAvatars,
    userPersona: snapshot.sections.userPersona,
    scenario: snapshot.sections.worldContext,
  }
}

function toRecordedAvatarKnowledge(
  knowledge: AvatarContextSnapshot['sections']['retrievedContext'],
): RecordedAvatarContextKnowledgeInjection | undefined {
  if (knowledge === undefined) return undefined
  const typedSections = toRecordedTypedKnowledgeSections(
    knowledge.typedSections ?? groupRetrievedItemsByType(knowledge.retrievedItems),
  )
  return typedSections
}

function toRecordedTypedKnowledgeSections(
  knowledge:
    | AvatarTypedSections
    | NonNullable<GmContextSnapshot['sections']['retrievedContext']>
    | undefined,
): RecordedTypedKnowledgeSections | undefined {
  if (knowledge === undefined) return undefined

  const typedSections: RecordedTypedKnowledgeSections = {
    memory: knowledge.memory.map(toRecordedKnowledgeReference),
    world: knowledge.world.map(toRecordedKnowledgeReference),
    media: knowledge.media.map(toRecordedKnowledgeReference),
  }

  return hasRecordedKnowledge(typedSections) ? typedSections : undefined
}

function groupRetrievedItemsByType(items: RetrievedKnowledgeItem[]): {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
} {
  return items.reduce(
    (grouped, item) => {
      grouped[item.knowledgeType].push(item)
      return grouped
    },
    {
      memory: [] as RetrievedKnowledgeItem[],
      world: [] as RetrievedKnowledgeItem[],
      media: [] as RetrievedKnowledgeItem[],
    },
  )
}

function toRecordedKnowledgeReference(item: RetrievedKnowledgeItem): RecordedKnowledgeReferenceDto {
  return {
    sourceId: item.sourceId,
    chunkId: item.chunkId,
    knowledgeType: item.knowledgeType,
    ...(item.score !== undefined ? { score: item.score } : {}),
    ...(item.reason !== undefined ? { reason: item.reason } : {}),
    ...(item.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: item.visibleToAvatarIds }
      : {}),
  }
}

function hasRecordedKnowledge(typedSections: RecordedTypedKnowledgeSections): boolean {
  return (
    typedSections.memory.length > 0 ||
    typedSections.world.length > 0 ||
    typedSections.media.length > 0
  )
}
