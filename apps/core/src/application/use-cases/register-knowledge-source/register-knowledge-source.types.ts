import type {
  KnowledgeSourceFormat,
  KnowledgeSourceStatus,
  KnowledgeType,
} from '../../../domain/knowledge/knowledge.types.js'

export type RegisterKnowledgeSourceInput = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  metadata?: Record<string, unknown>
  triggerIngestion?: boolean
  correlationId?: string
}

export type RegisterKnowledgeSourceOutput = {
  source: {
    sourceId: string
    scenarioId: string
    name: string
    knowledgeType: KnowledgeType
    format: KnowledgeSourceFormat
    uriOrPath: string
    status: KnowledgeSourceStatus
    createdAt: string
    updatedAt: string
    metadata?: Record<string, unknown>
  }
  ingestionJob: {
    ingestionJobId: string
    sourceId: string
    status: 'queued' | 'running' | 'completed' | 'failed'
    attempts: number
    createdAt: string
    updatedAt: string
    startedAt?: string
    completedAt?: string
    errorMessage?: string
  }
  ingestionScheduled: boolean
}
