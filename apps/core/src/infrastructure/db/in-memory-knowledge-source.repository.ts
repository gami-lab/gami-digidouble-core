import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
} from '../../application/ports/IKnowledgeSourceRepository.js'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'

export class InMemoryKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  private readonly sources: Map<string, KnowledgeSource>

  constructor(initialData: KnowledgeSource[] = []) {
    this.sources = new Map(initialData.map((source) => [source.sourceId, source]))
  }

  create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource> {
    const now = new Date().toISOString()
    const source: KnowledgeSource = {
      sourceId: `knowledge_source_${crypto.randomUUID()}`,
      scenarioId: params.scenarioId,
      name: params.name,
      knowledgeType: params.knowledgeType,
      format: params.format,
      uriOrPath: params.uriOrPath,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    }

    this.sources.set(source.sourceId, source)
    return Promise.resolve(source)
  }

  findById(sourceId: string): Promise<KnowledgeSource | null> {
    return Promise.resolve(this.sources.get(sourceId) ?? null)
  }

  listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]> {
    const sources = [...this.sources.values()]
      .filter((source) => source.scenarioId === filters.scenarioId)
      .filter((source) =>
        filters.knowledgeType === undefined ? true : source.knowledgeType === filters.knowledgeType,
      )
      .filter((source) => (filters.status === undefined ? true : source.status === filters.status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

    return Promise.resolve(sources)
  }

  updateStatus(
    sourceId: string,
    status: KnowledgeSource['status'],
  ): Promise<KnowledgeSource | null> {
    const existing = this.sources.get(sourceId)
    if (existing === undefined) return Promise.resolve(null)

    const updated: KnowledgeSource = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    }
    this.sources.set(sourceId, updated)
    return Promise.resolve(updated)
  }
}
