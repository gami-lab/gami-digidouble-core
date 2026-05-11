import type { KnowledgeSourceDto, KnowledgeSourceStatus, KnowledgeType } from '@gami/shared'

export type ListKnowledgeSourcesInput = {
  scenarioId: string
  knowledgeType?: KnowledgeType
  status?: KnowledgeSourceStatus
}

export type ListKnowledgeSourcesOutput = {
  sources: KnowledgeSourceDto[]
}
