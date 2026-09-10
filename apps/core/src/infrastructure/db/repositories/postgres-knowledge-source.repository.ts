import type { JSONValue, Sql } from 'postgres'
import type {
  CreateKnowledgeSourceParams,
  IKnowledgeSourceRepository,
  ListKnowledgeSourcesFilters,
  UpdateKnowledgeSourceParams,
} from '../../../application/ports/IKnowledgeSourceRepository.js'
import {
  buildKnowledgeVisibilitySelection,
  normalizeKnowledgeVisibilitySelection,
} from '../../../domain/knowledge/knowledge-visibility.js'
import type {
  KnowledgeSource,
  KnowledgeSourceQuarantine,
  KnowledgeVisibilityPolicy,
} from '../../../domain/knowledge/knowledge.types.js'
import { assertStaticMetadataAllowed } from '../../../domain/knowledge/legacy-memory-audit.js'
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
  quarantine_classification?: string | null
  quarantine_reason?: string | null
  quarantine_offending_key_names?: string[] | null
  quarantine_quarantined_at?: Date | null
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
  const visibility = normalizeKnowledgeVisibilitySelection(
    buildKnowledgeVisibilitySelection(
      normalizeVisibilityPolicy(row.visibility_policy),
      normalizeVisibleToAvatarIds(row.visible_to_avatar_ids),
    ),
    { inferAvatarPolicyFromIds: true },
  )
  const metadata = normalizeMetadata(row.metadata)
  const quarantine = normalizeQuarantine(row)
  return {
    sourceId: `knowledge_source_${row.id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    name: row.name,
    knowledgeType: row.knowledge_type,
    format: row.format,
    uriOrPath: row.uri_or_path,
    status: row.status,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(visibility.visibilityPolicy !== undefined
      ? { visibilityPolicy: visibility.visibilityPolicy }
      : {}),
    ...(visibility.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: visibility.visibleToAvatarIds }
      : {}),
    ...(quarantine !== undefined ? { quarantine } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function normalizeQuarantine(row: KnowledgeSourceRow): KnowledgeSourceQuarantine | undefined {
  if (
    row.quarantine_classification !== 'ambiguous_or_invalid_user_specific' ||
    row.quarantine_reason === null ||
    row.quarantine_reason === undefined ||
    row.quarantine_quarantined_at === null ||
    row.quarantine_quarantined_at === undefined
  ) {
    return undefined
  }
  return {
    classification: 'ambiguous_or_invalid_user_specific',
    reason: row.quarantine_reason,
    offendingKeyNames: [...(row.quarantine_offending_key_names ?? [])],
    quarantinedAt: row.quarantine_quarantined_at.toISOString(),
  }
}

export class PostgresKnowledgeSourceRepository implements IKnowledgeSourceRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateKnowledgeSourceParams): Promise<KnowledgeSource> {
    assertStaticMetadataAllowed(params.metadata, 'source')
    const scenarioUuid = stripPrefix('scenario_', params.scenarioId)
    const visibility = normalizeKnowledgeVisibilitySelection(
      buildKnowledgeVisibilitySelection(
        params.visibilityPolicy,
        normalizeVisibleToAvatarIds(params.visibleToAvatarIds),
      ),
      { inferAvatarPolicyFromIds: true },
    )

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
        ${visibility.visibilityPolicy ?? null},
        ${visibility.visibleToAvatarIds ?? null}
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
      SELECT s.id, s.scenario_id, s.name, s.knowledge_type, s.format, s.uri_or_path, s.status,
        s.metadata, s.visibility_policy, s.visible_to_avatar_ids, s.created_at, s.updated_at,
        q.classification AS quarantine_classification, q.reason AS quarantine_reason,
        q.offending_key_names AS quarantine_offending_key_names, q.quarantined_at AS quarantine_quarantined_at
      FROM knowledge_sources s
      LEFT JOIN knowledge_source_quarantines q ON q.source_id = s.id
      WHERE s.id = ${sourceUuid}
    `

    return row === undefined ? null : rowToKnowledgeSource(row)
  }

  async listAll(): Promise<KnowledgeSource[]> {
    const rows = await this.sql<KnowledgeSourceRow[]>`
      SELECT s.id, s.scenario_id, s.name, s.knowledge_type, s.format, s.uri_or_path, s.status, s.metadata,
        s.visibility_policy, s.visible_to_avatar_ids, s.created_at, s.updated_at,
        q.classification AS quarantine_classification, q.reason AS quarantine_reason,
        q.offending_key_names AS quarantine_offending_key_names, q.quarantined_at AS quarantine_quarantined_at
      FROM knowledge_sources s
      LEFT JOIN knowledge_source_quarantines q ON q.source_id = s.id
      ORDER BY s.id ASC
    `
    return rows.map(rowToKnowledgeSource)
  }

  async listByScenario(filters: ListKnowledgeSourcesFilters): Promise<KnowledgeSource[]> {
    const scenarioUuid = extractUuid('scenario_', filters.scenarioId)
    if (scenarioUuid === null) return []

    const rows = await this.sql<KnowledgeSourceRow[]>`
      SELECT s.id, s.scenario_id, s.name, s.knowledge_type, s.format, s.uri_or_path, s.status, s.metadata,
        s.visibility_policy, s.visible_to_avatar_ids, s.created_at, s.updated_at,
        q.classification AS quarantine_classification, q.reason AS quarantine_reason,
        q.offending_key_names AS quarantine_offending_key_names, q.quarantined_at AS quarantine_quarantined_at
      FROM knowledge_sources s
      LEFT JOIN knowledge_source_quarantines q ON q.source_id = s.id
      WHERE s.scenario_id = ${scenarioUuid}
        AND (${filters.knowledgeType ?? null}::text IS NULL OR s.knowledge_type = ${filters.knowledgeType ?? null})
        AND (${filters.status ?? null}::text IS NULL OR s.status = ${filters.status ?? null})
      ORDER BY s.created_at DESC
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

    return row === undefined ? null : this.findById(sourceId)
  }

  async update(
    sourceId: string,
    updates: UpdateKnowledgeSourceParams,
  ): Promise<KnowledgeSource | null> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return null
    assertStaticMetadataAllowed(updates.metadata, 'source')

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
    return row === undefined ? null : this.findById(sourceId)
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
