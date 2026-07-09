import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
  UpdateKnowledgeSourceParams,
} from '../../application/ports/IKnowledgeSourceRepository.js'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'

function normalizeVisibleToAvatarIds(
  visibleToAvatarIds: string[] | undefined,
): string[] | undefined {
  if (visibleToAvatarIds === undefined) return undefined
  const normalized = visibleToAvatarIds
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

export class InMemoryKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  private readonly sources: Map<string, KnowledgeSource>

  constructor(initialData: KnowledgeSource[] = []) {
    this.sources = new Map(initialData.map((source) => [source.sourceId, source]))
  }

  create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource> {
    const now = new Date().toISOString()
    const visibleToAvatarIds = normalizeVisibleToAvatarIds(params.visibleToAvatarIds)
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
      ...(params.visibilityPolicy !== undefined
        ? { visibilityPolicy: params.visibilityPolicy }
        : {}),
      ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
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

  update(sourceId: string, updates: UpdateKnowledgeSourceParams): Promise<KnowledgeSource | null> {
    const existing = this.sources.get(sourceId)
    if (existing === undefined) return Promise.resolve(null)

    const updated: KnowledgeSource = {
      ...existing,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.uriOrPath !== undefined ? { uriOrPath: updates.uriOrPath } : {}),
      ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.visibilityPolicy !== undefined
        ? { visibilityPolicy: updates.visibilityPolicy }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    if (updates.visibleToAvatarIds !== undefined) {
      const normalized = normalizeVisibleToAvatarIds(updates.visibleToAvatarIds)
      if (normalized !== undefined) {
        updated.visibleToAvatarIds = normalized
      } else {
        delete updated.visibleToAvatarIds
      }
    }

    this.sources.set(sourceId, updated)
    return Promise.resolve(updated)
  }

  delete(sourceId: string): Promise<void> {
    this.sources.delete(sourceId)
    return Promise.resolve()
  }
}
