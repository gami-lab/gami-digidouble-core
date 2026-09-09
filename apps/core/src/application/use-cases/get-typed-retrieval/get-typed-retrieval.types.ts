import type { QueryKnowledgeRetrievalRequest } from '@gami/shared'
import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'

// Ownership: admin retrieval HTTP contracts come from @gami/shared.
export type GetTypedRetrievalInput = QueryKnowledgeRetrievalRequest

export type GetTypedRetrievalOutput = {
  retrieval: TypedRetrievalResult
}
