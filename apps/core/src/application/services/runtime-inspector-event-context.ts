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
  const retrievedContext = toRecordedAvatarKnowledge(snapshot.sections.retrievedContext)
  const avatarTraits = toRecordedAvatarTraitsSummary(snapshot.sections.avatarTraits)

  return {
    ...(snapshot.avatarId !== undefined ? { avatarId: snapshot.avatarId } : {}),
    sections: {
      directorNotes: snapshot.sections.directorNotes,
      responseRules: {
        count: snapshot.sections.responseRules.items.length,
      },
      conversationState: {
        recentExchanges: snapshot.sections.conversationState.recentExchanges,
        workingMemory: snapshot.sections.conversationState.workingMemory,
        longTermFacts: snapshot.sections.conversationState.longTermFacts,
      },
      ...(retrievedContext !== undefined ? { retrievedContext } : {}),
      userPersona: snapshot.sections.userPersona,
      worldContext: snapshot.sections.worldContext,
      ...(avatarTraits !== undefined ? { avatarTraits } : {}),
    },
  }
}

export function toRecordedGmContextSnapshot(
  snapshot: GmContextSnapshot,
): RecordedGmContextSnapshot {
  const retrievedContext = toRecordedTypedKnowledgeSections(snapshot.sections.retrievedContext)

  return {
    currentState: {
      progression: snapshot.currentState.progression,
      interactionCount: snapshot.currentState.interactionCount,
    },
    availableAvatars: snapshot.availableAvatars,
    sections: {
      conversationState: {
        recentMessages: snapshot.sections.conversationState.recentMessages,
        memory: snapshot.sections.conversationState.memory,
      },
      ...(retrievedContext !== undefined ? { retrievedContext } : {}),
      userPersona: snapshot.sections.userPersona,
      worldContext: snapshot.sections.worldContext,
    },
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
    content: item.content,
    ...(item.score !== undefined ? { score: item.score } : {}),
    ...(item.reason !== undefined ? { reason: item.reason } : {}),
    ...(item.matchedQuery !== undefined ? { matchedQuery: item.matchedQuery } : {}),
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

function toRecordedAvatarTraitsSummary(
  traits: AvatarContextSnapshot['sections']['avatarTraits'],
): RecordedAvatarContextSnapshot['sections']['avatarTraits'] | undefined {
  if (traits === undefined) return undefined
  return {
    sectionCounts: {
      identity: traits.identity.length,
      personality: traits.personality.length,
      speakingStyle: traits.speakingStyle.length,
      background: traits.background.length,
      timeline: traits.timeline.length,
      currentSituation: traits.currentSituation.length,
      behaviouralRules: traits.behaviouralRules.length,
    },
  }
}
