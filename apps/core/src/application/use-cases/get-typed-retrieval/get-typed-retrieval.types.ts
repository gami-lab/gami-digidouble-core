import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'

export type GetTypedRetrievalInput = {
  scenarioId: string
  query: string
  sessionId?: string
  userId?: string
  conversationId?: string
  limitPerType?: number
}

export type GetTypedRetrievalOutput = {
  retrieval: TypedRetrievalResult
}
