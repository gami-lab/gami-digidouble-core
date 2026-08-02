import type { Sql } from 'postgres'
import type {
  CreateIngestionJobParams,
  IIngestionJobRepository,
  UpdateIngestionJobStatusParams,
} from '../../../application/ports/IIngestionJobRepository.js'
import type { IngestionJob } from '../../../domain/knowledge/knowledge.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type IngestionJobRow = {
  id: string
  source_id: string
  status: IngestionJob['status']
  attempts: number
  chunk_size: number | null
  started_at: Date | null
  completed_at: Date | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

function rowToIngestionJob(row: IngestionJobRow): IngestionJob {
  return {
    ingestionJobId: `ingestion_job_${row.id}`,
    sourceId: `knowledge_source_${row.source_id}`,
    status: row.status,
    attempts: row.attempts,
    ...(row.chunk_size !== null ? { chunkSize: row.chunk_size } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at.toISOString() } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at.toISOString() } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresIngestionJobRepository implements IIngestionJobRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateIngestionJobParams): Promise<IngestionJob> {
    const sourceUuid = stripPrefix('knowledge_source_', params.sourceId)

    const [row] = await this.sql<[IngestionJobRow?]>`
      INSERT INTO ingestion_jobs (
        source_id,
        status,
        attempts,
        chunk_size,
        started_at,
        completed_at,
        error_message
      )
      VALUES (
        ${sourceUuid},
        ${params.status ?? 'queued'},
        ${params.attempts ?? 0},
        ${params.chunkSize ?? null},
        ${params.startedAt ?? null}::timestamptz,
        ${params.completedAt ?? null}::timestamptz,
        ${params.errorMessage ?? null}
      )
      RETURNING id, source_id, status, attempts, chunk_size, started_at, completed_at, error_message, created_at, updated_at
    `

    if (row === undefined) {
      throw new Error(`Ingestion job create failed for sourceId=${params.sourceId}.`)
    }

    return rowToIngestionJob(row)
  }

  async findById(ingestionJobId: string): Promise<IngestionJob | null> {
    const jobUuid = extractUuid('ingestion_job_', ingestionJobId)
    if (jobUuid === null) return null

    const [row] = await this.sql<[IngestionJobRow?]>`
      SELECT id, source_id, status, attempts, chunk_size, started_at, completed_at, error_message, created_at, updated_at
      FROM ingestion_jobs
      WHERE id = ${jobUuid}
    `

    return row === undefined ? null : rowToIngestionJob(row)
  }

  async listBySourceId(sourceId: string): Promise<IngestionJob[]> {
    const sourceUuid = extractUuid('knowledge_source_', sourceId)
    if (sourceUuid === null) return []

    const rows = await this.sql<IngestionJobRow[]>`
      SELECT id, source_id, status, attempts, chunk_size, started_at, completed_at, error_message, created_at, updated_at
      FROM ingestion_jobs
      WHERE source_id = ${sourceUuid}
      ORDER BY created_at DESC
    `

    return rows.map(rowToIngestionJob)
  }

  async updateStatus(
    ingestionJobId: string,
    updates: UpdateIngestionJobStatusParams,
  ): Promise<IngestionJob | null> {
    const jobUuid = extractUuid('ingestion_job_', ingestionJobId)
    if (jobUuid === null) return null

    const [row] = await this.sql<[IngestionJobRow?]>`
      UPDATE ingestion_jobs
      SET
        status = ${updates.status},
        attempts = COALESCE(${updates.attempts ?? null}, attempts),
        started_at = COALESCE(${updates.startedAt ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${updates.completedAt ?? null}::timestamptz, completed_at),
        error_message = CASE
          WHEN ${updates.errorMessage ?? null}::text IS NULL THEN error_message
          ELSE ${updates.errorMessage ?? null}
        END,
        updated_at = NOW()
      WHERE id = ${jobUuid}
      RETURNING id, source_id, status, attempts, chunk_size, started_at, completed_at, error_message, created_at, updated_at
    `

    return row === undefined ? null : rowToIngestionJob(row)
  }
}
