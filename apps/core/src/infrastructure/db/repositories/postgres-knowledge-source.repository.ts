import type { JSONValue, Sql } from 'postgres'
import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
} from '../../../application/ports/IKnowledgeSourceRepository.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type KnowledgeSourceRow = {
  id: string
  scenario_id: string
  name: string
  knowledge_type: KnowledgeSource['knowledgeType']
  format: KnowledgeSource['format']
  uri_or_path: string
  status: KnowledgeSource['status']
  metadata: unknown
  visible_to_avatar_ids: string[] | null
  created_at: Date
  updated_at: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeVisibleToAvatarIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function rowToKnowledgeSource(row: KnowledgeSourceRow): KnowledgeSource {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(row.visible_to_avatar_ids)
  return {
    sourceId: `knowledge_source_${row.id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    name: row.name,
    knowledgeType: row.knowledge_type,
    format: row.format,
    uriOrPath: row.uri_or_path,
    status: row.status,
    ...(isRecord(row.metadata) ? { metadata: row.metadata } : {}),
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource> {
    const scenarioUuid = stripPrefix('scenario_', params.scenarioId)

    const visibleToAvatarIds = normalizeVisibleToAvatarIds(params.visibleToAvatarIds)

    const [row] = await this.sql<[KnowledgeSourceRow?]>`
      INSERT INTO knowledge_sources (
        scenario_id,
        name,
        knowledge_type,
        format,
        uri_or_path,
        status,
        metadata,
        visible_to_avatar_ids
      )
      VALUES (
        ${scenarioUuid},
        ${params.name},
        ${params.knowledgeType},
        ${params.format},
        ${params.uriOrPath},
        ${'pending'},
        ${this.sql.json((params.metadata ?? {}) as JSONValue)},
        ${visibleToAvatarIds ?? null}
      )
      RETURNING id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visible_to_avatar_ids, created_at, updated_at
    `

    if (row === undefined) {
      throw new Error(`Knowledge source create failed for scenarioId=${params.scenarioId}.`)
    }

    return rowToKnowledgeSource(row)
  }

  async findById(sourceId: string): Promise<KnowledgeSource | null> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return null

    const [row] = await this.sql<[KnowledgeSourceRow?]>`
      SELECT id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visible_to_avatar_ids, created_at, updated_at
      FROM knowledge_sources
      WHERE id = ${sourceUuid}
    `

    return row === undefined ? null : rowToKnowledgeSource(row)
  }

  async listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]> {
    const scenarioUuid = extractUuid('scenario_', filters.scenarioId)
    if (scenarioUuid === null) return []

    const rows = await this.sql<KnowledgeSourceRow[]>`
      SELECT id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visible_to_avatar_ids, created_at, updated_at
      FROM knowledge_sources
      WHERE scenario_id = ${scenarioUuid}
        AND (${filters.knowledgeType ?? null}::text IS NULL OR knowledge_type = ${filters.knowledgeType ?? null})
        AND (${filters.status ?? null}::text IS NULL OR status = ${filters.status ?? null})
      ORDER BY created_at DESC
    `

    return rows.map(rowToKnowledgeSource)
  }

  async updateStatus(
    sourceId: string,
    status: KnowledgeSource['status'],
  ): Promise<KnowledgeSource | null> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return null

    const [row] = await this.sql<[KnowledgeSourceRow?]>`
      UPDATE knowledge_sources
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${sourceUuid}
      RETURNING id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visible_to_avatar_ids, created_at, updated_at
    `

    return row === undefined ? null : rowToKnowledgeSource(row)
  }
}
