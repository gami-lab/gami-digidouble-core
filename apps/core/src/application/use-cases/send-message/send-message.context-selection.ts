import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import { toRetrievalTraceDto } from '../../services/runtime-inspector-event-context.js'

export type ContextSelectionMetadata = {
  shortTermExchangeCount: number
  hasWorkingMemory: boolean
  longTermFactCount: number
  retrieval?: {
    selectedForAssemblyCounts: {
      avatar_knowledge: number
      world: number
      media: number
    }
    includedCounts: {
      avatar_knowledge: number
      world: number
      media: number
    }
    omittedByAssemblyCounts: {
      avatar_knowledge: number
      world: number
      media: number
    }
    excludedByVisibilityCounts?: {
      avatar_knowledge: number
      world: number
      media: number
    }
    retrievalTrace?: ReturnType<typeof toRetrievalTraceDto>
  }
  contextEngineSelection?: {
    keptSegmentCount: number
    trimmedSegmentCount: number
  }
  hasUserPersona: boolean
  hasGmDirective: boolean
  responseRuleCount: number
  hasAvatarTraits: boolean
}

export function toContextSelectionMetadata(
  assembledContext: ContextEngineOutput,
): ContextSelectionMetadata {
  const selected = assembledContext.trace.selectedInputs
  const includedCounts = toIncludedRetrievalCounts(assembledContext)
  const omittedByAssemblyCounts = {
    avatar_knowledge: Math.max(
      0,
      selected.retrievalCounts.avatar_knowledge - includedCounts.avatar_knowledge,
    ),
    world: Math.max(0, selected.retrievalCounts.world - includedCounts.world),
    media: Math.max(0, selected.retrievalCounts.media - includedCounts.media),
  }
  return {
    shortTermExchangeCount: selected.shortTermExchangeCount,
    hasWorkingMemory: selected.hasWorkingMemory,
    longTermFactCount: selected.longTermFactCount,
    retrieval: {
      selectedForAssemblyCounts: selected.retrievalCounts,
      includedCounts,
      omittedByAssemblyCounts,
      ...(selected.visibility !== undefined
        ? { excludedByVisibilityCounts: selected.visibility.excludedCounts }
        : {}),
      ...(selected.retrieval !== undefined
        ? { retrievalTrace: toRetrievalTraceDto(selected.retrieval) }
        : {}),
    },
    contextEngineSelection: {
      keptSegmentCount: assembledContext.trace.selection.kept.length,
      trimmedSegmentCount: assembledContext.trace.selection.trimmed.length,
    },
    hasUserPersona: selected.hasUserPersona,
    hasGmDirective: selected.hasGmDirective,
    responseRuleCount: selected.responseRuleCount,
    hasAvatarTraits: selected.hasAvatarTraits,
  }
}

function toIncludedRetrievalCounts(assembledContext: ContextEngineOutput): {
  avatar_knowledge: number
  world: number
  media: number
} {
  const typedSections = assembledContext.avatar.sections.retrievedContext?.typedSections
  if (typedSections !== undefined) {
    return {
      avatar_knowledge: typedSections.avatar_knowledge.length,
      world: typedSections.world.length,
      media: typedSections.media.length,
    }
  }

  const retrievedItems = assembledContext.avatar.sections.retrievedContext?.retrievedItems ?? []
  return retrievedItems.reduce(
    (counts, item) => {
      counts[item.knowledgeType] += 1
      return counts
    },
    { avatar_knowledge: 0, world: 0, media: 0 },
  )
}
