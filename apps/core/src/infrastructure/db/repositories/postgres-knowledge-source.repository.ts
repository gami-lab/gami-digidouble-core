import type { JSONValue, Sql } from 'postgres'
import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
  UpdateKnowledgeSourceParams,
} from '../../../application/ports/IKnowledgeSourceRepository.js'
import type {
  KnowledgeSource,
  KnowledgeVisibilityPolicy,
} from '../../../domain/knowledge/knowledge.types.js'
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
  visibility_policy: string | null
  visible_to_avatar_ids: string[] | null
  created_at: Date
  updated_at: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// sql.unsafe() (used by update()) does not decode jsonb columns into objects
// the way tagged-template queries do — it returns the raw JSON text instead.
function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function normalizeVisibleToAvatarIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeVisibilityPolicy(value: unknown): KnowledgeVisibilityPolicy | undefined {
  if (value === 'all' || value === 'avatars' || value === 'none') return value
  return undefined
}

function rowToKnowledgeSource(row: KnowledgeSourceRow): KnowledgeSource {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(row.visible_to_avatar_ids)
  const visibilityPolicy = normalizeVisibilityPolicy(row.visibility_policy)
  const metadata = normalizeMetadata(row.metadata)
  return {
    sourceId: `knowledge_source_${row.id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    name: row.name,
    knowledgeType: row.knowledge_type,
    format: row.format,
    uriOrPath: row.uri_or_path,
    status: row.status,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(visibilityPolicy !== undefined ? { visibilityPolicy } : {}),
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
        visibility_policy,
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
        ${params.visibilityPolicy ?? null},
        ${visibleToAvatarIds ?? null}
      )
      RETURNING id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visibility_policy, visible_to_avatar_ids, created_at, updated_at
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
      SELECT id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visibility_policy, visible_to_avatar_ids, created_at, updated_at
      FROM knowledge_sources
      WHERE id = ${sourceUuid}
    `

    return row === undefined ? null : rowToKnowledgeSource(row)
  }

  async listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]> {
    const scenarioUuid = extractUuid('scenario_', filters.scenarioId)
    if (scenarioUuid === null) return []

    const rows = await this.sql<KnowledgeSourceRow[]>`
      SELECT id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visibility_policy, visible_to_avatar_ids, created_at, updated_at
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
      RETURNING id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visibility_policy, visible_to_avatar_ids, created_at, updated_at
    `

    return row === undefined ? null : rowToKnowledgeSource(row)
  }

  async update(
    sourceId: string,
    updates: UpdateKnowledgeSourceParams,
  ): Promise<KnowledgeSource | null> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return null

    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []

    if (updates.name !== undefined) {
      values.push(updates.name)
      setClauses.push(`name = $${String(values.length)}`)
    }
    if (updates.uriOrPath !== undefined) {
      values.push(updates.uriOrPath)
      setClauses.push(`uri_or_path = $${String(values.length)}`)
    }
    if (updates.metadata !== undefined) {
      values.push(JSON.stringify(updates.metadata))
      setClauses.push(`metadata = $${String(values.length)}::jsonb`)
    }
    if (updates.visibilityPolicy !== undefined) {
      values.push(updates.visibilityPolicy)
      setClauses.push(`visibility_policy = $${String(values.length)}`)
    }
    if (updates.visibleToAvatarIds !== undefined) {
      values.push(normalizeVisibleToAvatarIds(updates.visibleToAvatarIds) ?? null)
      setClauses.push(`visible_to_avatar_ids = $${String(values.length)}`)
    }
    if (updates.status !== undefined) {
      values.push(updates.status)
      setClauses.push(`status = $${String(values.length)}`)
    }

    values.push(sourceUuid)
    const whereParam = `$${String(values.length)}`

    const query = `
      UPDATE knowledge_sources
      SET ${setClauses.join(', ')}
      WHERE id = ${whereParam}
      RETURNING id, scenario_id, name, knowledge_type, format, uri_or_path, status, metadata, visibility_policy, visible_to_avatar_ids, created_at, updated_at
    `

    const rows = await this.sql.unsafe(query, values as string[])
    const row = rows[0] as KnowledgeSourceRow | undefined
    return row === undefined ? null : rowToKnowledgeSource(row)
  }

  async delete(sourceId: string): Promise<void> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return

    await this.sql`
      DELETE FROM knowledge_sources
      WHERE id = ${sourceUuid}
    `
  }
}
