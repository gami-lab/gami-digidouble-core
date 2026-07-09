import type {
  KnowledgeSource,
  KnowledgeSourceFormat,
  KnowledgeSourceStatus,
  KnowledgeType,
  KnowledgeVisibilityPolicy,
} from '../../domain/knowledge/knowledge.types.js'

export type CreateKnowledgeSourceParams = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  metadata?: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
}

export type ListKnowledgeSourcesFilters = {
  scenarioId: string
  knowledgeType?: KnowledgeType
  status?: KnowledgeSourceStatus
}

export type UpdateKnowledgeSourceParams = {
  name?: string
  metadata?: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
  uriOrPath?: string
  status?: KnowledgeSourceStatus
}

export interface IKnowledgeSourceRepository {
  create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource>
  findById(sourceId: string): Promise<KnowledgeSource | null>
  listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]>
  updateStatus(sourceId: string, status: KnowledgeSourceStatus): Promise<KnowledgeSource | null>
  update(sourceId: string, updates: UpdateKnowledgeSourceParams): Promise<KnowledgeSource | null>
  delete(sourceId: string): Promise<void>
}
