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
  hasUserPersona: boolean
  hasGmDirective: boolean
} {
  const selected = assembledContext.trace.selectedInputs
  return {
    shortTermExchangeCount: selected.shortTermExchangeCount,
    hasWorkingMemory: selected.hasWorkingMemory,
    longTermFactCount: selected.longTermFactCount,
    retrievalCounts: selected.retrievalCounts,
    hasUserPersona: selected.hasUserPersona,
    hasGmDirective: selected.hasGmDirective,
  }
}
