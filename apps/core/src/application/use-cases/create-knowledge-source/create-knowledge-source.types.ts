import type { CreateKnowledgeSourceRequest, KnowledgeSourceDto } from '@gami/shared'

// Ownership: API-facing request/response fragments come from @gami/shared.
export type CreateKnowledgeSourceInput = CreateKnowledgeSourceRequest

export type CreateKnowledgeSourceOutput = {
  source: KnowledgeSourceDto
}
