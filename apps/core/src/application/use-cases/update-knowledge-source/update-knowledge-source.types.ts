import type { KnowledgeSourceDto, UpdateKnowledgeSourceRequest } from '@gami/shared'

export type UpdateKnowledgeSourceInput = UpdateKnowledgeSourceRequest & {
  sourceId: string
}

export type UpdateKnowledgeSourceOutput = {
  source: KnowledgeSourceDto
}
