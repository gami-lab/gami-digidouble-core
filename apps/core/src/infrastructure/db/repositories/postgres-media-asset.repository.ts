import type { Sql } from 'postgres'
import type { MediaKind, MediaRef, MediaSource } from '@gami/shared'
import type {
  CreateMediaAssetParams,
  IMediaAssetRepository,
  UpdateMediaAssetParams,
} from '../../../application/ports/IMediaAssetRepository.js'
import type { MediaAsset } from '../../../domain/media/media-asset.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

const ASSET_PREFIX = 'media_'
const SCENARIO_PREFIX = 'scenario_'

interface MediaAssetRow {
  id: string
  scenario_id: string
  kind: MediaKind
  source: MediaSource
  storage_key: string | null
  url: string | null
  mime_type: string
  byte_size: string | null
  poster_asset_id: string | null
  duration_ms: number | null
  description: string
  cueable: boolean
  created_at: Date
  updated_at: Date
}

export class PostgresMediaAssetRepository implements IMediaAssetRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateMediaAssetParams): Promise<MediaAsset> {
    const [row] = await this.sql<MediaAssetRow[]>`
      INSERT INTO media_assets (
        id, scenario_id, kind, source, storage_key, url, mime_type, byte_size,
        poster_asset_id, duration_ms, description, cueable
      ) VALUES (
        ${stripPrefix(ASSET_PREFIX, params.assetId)},
        ${stripPrefix(SCENARIO_PREFIX, params.scenarioId)},
        ${params.kind}, ${params.source}, ${params.storageKey}, ${params.url}, ${params.mimeType},
        ${params.byteSize}, ${toUuidOrNull(params.posterAssetId)}, ${params.durationMs},
        ${params.description}, ${params.cueable}
      )
      RETURNING *
    `
    if (row === undefined) throw new Error('Media asset insert returned no row.')
    return toMediaAsset(row)
  }

  async findById(assetId: MediaRef): Promise<MediaAsset | null> {
    const id = extractUuid(ASSET_PREFIX, assetId)
    if (id === null) return null
    const [row] = await this.sql<MediaAssetRow[]>`SELECT * FROM media_assets WHERE id = ${id}`
    return row === undefined ? null : toMediaAsset(row)
  }

  async findByIds(scenarioId: string, assetIds: readonly MediaRef[]): Promise<MediaAsset[]> {
    const scenario = extractUuid(SCENARIO_PREFIX, scenarioId)
    const ids = assetIds.flatMap((assetId) => extractUuid(ASSET_PREFIX, assetId) ?? [])
    if (scenario === null || ids.length === 0) return []
    const rows = await this.sql<MediaAssetRow[]>`
      SELECT * FROM media_assets WHERE scenario_id = ${scenario} AND id = ANY(${ids}::uuid[])
    `
    return rows.map(toMediaAsset)
  }

  async listByScenario(scenarioId: string): Promise<MediaAsset[]> {
    const scenario = extractUuid(SCENARIO_PREFIX, scenarioId)
    if (scenario === null) return []
    const rows = await this.sql<MediaAssetRow[]>`
      SELECT * FROM media_assets WHERE scenario_id = ${scenario} ORDER BY created_at, id
    `
    return rows.map(toMediaAsset)
  }

  async update(assetId: MediaRef, updates: UpdateMediaAssetParams): Promise<MediaAsset | null> {
    const id = extractUuid(ASSET_PREFIX, assetId)
    if (id === null) return null
    const columns = toUpdateColumns(updates)
    const keys = Object.keys(columns)
    const [row] =
      keys.length === 0
        ? await this.sql<MediaAssetRow[]>`
            UPDATE media_assets SET updated_at = NOW() WHERE id = ${id} RETURNING *
          `
        : await this.sql<MediaAssetRow[]>`
            UPDATE media_assets SET ${this.sql(columns, keys)}, updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
          `
    return row === undefined ? null : toMediaAsset(row)
  }

  async delete(assetId: MediaRef): Promise<void> {
    const id = extractUuid(ASSET_PREFIX, assetId)
    if (id === null) return
    await this.sql`DELETE FROM media_assets WHERE id = ${id}`
  }
}

function toUpdateColumns(
  updates: UpdateMediaAssetParams,
): Record<string, string | number | boolean | null> {
  return {
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.cueable !== undefined ? { cueable: updates.cueable } : {}),
    ...(updates.posterAssetId !== undefined
      ? { poster_asset_id: toUuidOrNull(updates.posterAssetId) }
      : {}),
    ...(updates.durationMs !== undefined ? { duration_ms: updates.durationMs } : {}),
  }
}

function toUuidOrNull(assetId: MediaRef | null): string | null {
  return assetId === null ? null : stripPrefix(ASSET_PREFIX, assetId)
}

function toMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    assetId: `${ASSET_PREFIX}${row.id}`,
    scenarioId: `${SCENARIO_PREFIX}${row.scenario_id}`,
    kind: row.kind,
    source: row.source,
    storageKey: row.storage_key,
    url: row.url,
    mimeType: row.mime_type,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    posterAssetId: row.poster_asset_id === null ? null : `${ASSET_PREFIX}${row.poster_asset_id}`,
    durationMs: row.duration_ms,
    description: row.description,
    cueable: row.cueable,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}
