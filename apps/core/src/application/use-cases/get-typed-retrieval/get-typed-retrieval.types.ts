import type { QueryKnowledgeRetrievalRequest, TypedKnowledgeRetrievalDto } from '@gami/shared'

// Ownership: admin retrieval HTTP contracts come from @gami/shared.
export type GetTypedRetrievalInput = QueryKnowledgeRetrievalRequest

export type GetTypedRetrievalOutput = {
  retrieval: TypedKnowledgeRetrievalDto
}
