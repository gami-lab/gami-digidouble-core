import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'

export function toContextSelectionMetadata(assembledContext: ContextEngineOutput): {
  shortTermExchangeCount: number
  hasWorkingMemory: boolean
  longTermFactCount: number
  retrievalCounts: {
    memory: number
    world: number
    media: number
  }
  visibility?: {
    activeAvatarId?: string
    excludedCounts: {
      memory: number
      world: number
      media: number
    }
    gmRetrievalCounts?: {
      memory: number
      world: number
      media: number
    }
    gmUnrestricted?: true
  }
  hasUserPersona: boolean
  hasGmDirective: boolean
} {
  const selected = assembledContext.trace.selectedInputs
  return {
    shortTermExchangeCount: selected.shortTermExchangeCount,
    hasWorkingMemory: selected.hasWorkingMemory,
    longTermFactCount: selected.longTermFactCount,
    retrievalCounts: selected.retrievalCounts,
    ...(selected.visibility !== undefined ? { visibility: selected.visibility } : {}),
    hasUserPersona: selected.hasUserPersona,
    hasGmDirective: selected.hasGmDirective,
  }
}
