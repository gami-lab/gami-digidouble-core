import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
  UpdateKnowledgeSourceParams,
} from '../../application/ports/IKnowledgeSourceRepository.js'
import {
  buildKnowledgeVisibilitySelection,
  normalizeKnowledgeVisibilitySelection,
} from '../../domain/knowledge/knowledge-visibility.js'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'

function normalizeSourceVisibility(
  source: Pick<KnowledgeSource, 'visibilityPolicy' | 'visibleToAvatarIds'>,
): Pick<KnowledgeSource, 'visibilityPolicy' | 'visibleToAvatarIds'> {
  const visibility = normalizeKnowledgeVisibilitySelection(
    buildKnowledgeVisibilitySelection(source.visibilityPolicy, source.visibleToAvatarIds),
    { inferAvatarPolicyFromIds: true },
  )

  return {
    ...(visibility.visibilityPolicy !== undefined
      ? { visibilityPolicy: visibility.visibilityPolicy }
      : {}),
    ...(visibility.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: visibility.visibleToAvatarIds }
      : {}),
  }
}

function normalizeSource(source: KnowledgeSource): KnowledgeSource {
  return {
    ...source,
    ...normalizeSourceVisibility(source),
  }
}

export class InMemoryKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  private readonly sources: Map<string, KnowledgeSource>

  constructor(initialData: KnowledgeSource[] = []) {
    this.sources = new Map(initialData.map((source) => [source.sourceId, normalizeSource(source)]))
  }

  create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource> {
    const now = new Date().toISOString()
    const visibility = normalizeSourceVisibility(params)
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
      ...visibility,
    }

    this.sources.set(source.sourceId, source)
    return Promise.resolve(normalizeSource(source))
  }

  findById(sourceId: string): Promise<KnowledgeSource | null> {
    const source = this.sources.get(sourceId)
    return Promise.resolve(source === undefined ? null : normalizeSource(source))
  }

  listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]> {
    const sources = [...this.sources.values()]
      .filter((source) => source.scenarioId === filters.scenarioId)
      .filter((source) =>
        filters.knowledgeType === undefined ? true : source.knowledgeType === filters.knowledgeType,
      )
      .filter((source) => (filters.status === undefined ? true : source.status === filters.status))
      .map(normalizeSource)
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
    return Promise.resolve(normalizeSource(updated))
  }

  update(sourceId: string, updates: UpdateKnowledgeSourceParams): Promise<KnowledgeSource | null> {
    const existing = this.sources.get(sourceId)
    if (existing === undefined) return Promise.resolve(null)

    const visibility = normalizeSourceVisibility(
      buildKnowledgeVisibilitySelection(updates.visibilityPolicy, updates.visibleToAvatarIds),
    )
    const updated: KnowledgeSource = {
      ...existing,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.uriOrPath !== undefined ? { uriOrPath: updates.uriOrPath } : {}),
      ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.visibilityPolicy !== undefined
        ? { visibilityPolicy: visibility.visibilityPolicy }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    if (updates.visibleToAvatarIds !== undefined) {
      if (visibility.visibleToAvatarIds !== undefined) {
        updated.visibleToAvatarIds = visibility.visibleToAvatarIds
      } else {
        delete updated.visibleToAvatarIds
      }
    }

    this.sources.set(sourceId, updated)
    return Promise.resolve(normalizeSource(updated))
  }

  delete(sourceId: string): Promise<void> {
    this.sources.delete(sourceId)
    return Promise.resolve()
  }
}
