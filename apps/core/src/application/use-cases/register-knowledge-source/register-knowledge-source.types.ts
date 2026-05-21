import type {
  IngestionJob,
  KnowledgeSourceFormat,
  KnowledgeSource,
  KnowledgeType,
} from '../../../domain/knowledge/knowledge.types.js'

// Ownership: internal source/job entities come from domain knowledge contracts.
export type RegisterKnowledgeSourceInput = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
  triggerIngestion?: boolean
  correlationId?: string
}

export type RegisterKnowledgeSourceOutput = {
  source: KnowledgeSource
  ingestionJob: IngestionJob
  ingestionScheduled: boolean
}
