import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'

export function toContextSelectionMetadata(assembledContext: ContextEngineOutput): {
  shortTermExchangeCount: number
  hasWorkingMemory: boolean
  longTermFactCount: number
  retrieval?: {
    selectedForAssemblyCounts: {
      memory: number
      world: number
      media: number
    }
    includedCounts: {
      memory: number
      world: number
      media: number
    }
    omittedByAssemblyCounts: {
      memory: number
      world: number
      media: number
    }
    excludedByVisibilityCounts?: {
      memory: number
      world: number
      media: number
    }
  }
  hasUserPersona: boolean
  hasGmDirective: boolean
} {
  const selected = assembledContext.trace.selectedInputs
  const includedCounts = toIncludedRetrievalCounts(assembledContext)
  const omittedByAssemblyCounts = {
    memory: Math.max(0, selected.retrievalCounts.memory - includedCounts.memory),
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
    },
    hasUserPersona: selected.hasUserPersona,
    hasGmDirective: selected.hasGmDirective,
  }
}

function toIncludedRetrievalCounts(assembledContext: ContextEngineOutput): {
  memory: number
  world: number
  media: number
} {
  const typedSections = assembledContext.avatar.sections.retrievedContext?.typedSections
  if (typedSections !== undefined) {
    return {
      memory: typedSections.memory.length,
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
    { memory: 0, world: 0, media: 0 },
  )
}
