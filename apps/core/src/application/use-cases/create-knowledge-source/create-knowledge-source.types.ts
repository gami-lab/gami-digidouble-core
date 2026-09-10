import type { CreateKnowledgeSourceRequest, KnowledgeSourceDto, KnowledgeType } from '@gami/shared'

export type CreateKnowledgeSourceInput = Omit<CreateKnowledgeSourceRequest, 'knowledgeType'> & {
  knowledgeType: KnowledgeType
}

export type CreateKnowledgeSourceOutput = {
  source: KnowledgeSourceDto
}
