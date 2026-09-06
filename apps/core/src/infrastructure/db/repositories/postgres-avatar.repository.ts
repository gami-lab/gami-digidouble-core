import type { JSONValue, Sql } from 'postgres'
import { coerceAvatarComputedTraits, isModelSelectionProviderName } from '@gami/shared'
import type {
  CreateAvatarParams,
  IAvatarRepository,
  UpdateAvatarParams,
} from '../../../application/ports/IAvatarRepository.js'
import type { AvatarComputedTraits, AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { AvatarLlmOverride } from '../../../domain/model-config/index.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface AvatarRow {
  id: string
  scenario_id: string
  name: string
  status: string
  persona_prompt: string
  tone: string | null
  description: string | null
  adjustments: string[] | null
  computed_traits: unknown
  config: unknown
  created_at: Date
  updated_at: Date
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function normalizeAvatarConfig(config: unknown): Record<string, unknown> {
  const record = asRecord(config)
  if (record !== null) return record

  if (typeof config === 'string') {
    try {
      const parsed: unknown = JSON.parse(config)
      return asRecord(parsed) ?? {}
    } catch {
      return {}
    }
  }

  return {}
}

function readAvatarLlmOverride(config: Record<string, unknown>): AvatarLlmOverride | undefined {
  const raw = asRecord(config['llmOverride'])
  if (raw === null) return undefined

  const provider = raw['provider']
  const model = raw['model']
  const hasProvider = typeof provider === 'string' && isModelSelectionProviderName(provider)
  const hasModel = typeof model === 'string' && model.trim().length > 0

  if (!hasProvider && !hasModel) return undefined

  return {
    ...(hasProvider ? { provider } : {}),
    ...(hasModel ? { model: model.trim() } : {}),
  }
}

function applyLlmOverride(
  config: Record<string, unknown>,
  llmOverride: AvatarLlmOverride | null | undefined,
): Record<string, unknown> {
  if (llmOverride === undefined) return config

  const nextConfig = { ...config }
  const hasProvider = llmOverride !== null && llmOverride.provider !== undefined
  const hasModel = llmOverride !== null && llmOverride.model !== undefined

  if (llmOverride === null || (!hasProvider && !hasModel)) {
    delete nextConfig['llmOverride']
    return nextConfig
  }

  nextConfig['llmOverride'] = {
    ...(hasProvider ? { provider: llmOverride.provider } : {}),
    ...(hasModel ? { model: llmOverride.model } : {}),
  }

  return nextConfig
}

function normalizeComputedTraits(value: unknown): AvatarComputedTraits | undefined {
  const normalized = coerceAvatarComputedTraits(value)
  if (normalized !== null) return normalized

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return coerceAvatarComputedTraits(parsed) ?? undefined
    } catch {
      return undefined
    }
  }

  return undefined
}

function rowToAvatarConfig(row: AvatarRow): AvatarConfig {
  const config = normalizeAvatarConfig(row.config)
  const llmOverride = readAvatarLlmOverride(config)
  const computedTraits = normalizeComputedTraits(row.computed_traits)

  return {
    avatarId: `avatar_${row.id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    name: row.name,
    status: row.status as AvatarConfig['status'],
    personaPrompt: row.persona_prompt,
    ...(row.tone !== null ? { tone: row.tone } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.adjustments !== null ? { adjustments: row.adjustments } : {}),
    ...(llmOverride !== undefined ? { llmOverride } : {}),
    ...(computedTraits !== undefined ? { computedTraits } : {}),
    config,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function buildUpdateSetClauses(updates: UpdateAvatarParams): {
  setClauses: string[]
  values: unknown[]
} {
  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []

  const fields: Array<[string, string | undefined]> = [
    ['name', updates.name],
    ['persona_prompt', updates.personaPrompt],
    ['tone', updates.tone],
    ['description', updates.description],
    ['status', updates.status],
  ]

  for (const [column, value] of fields) {
    if (value !== undefined) {
      values.push(value)
      setClauses.push(`${column} = $${String(values.length)}`)
    }
  }

  if (updates.adjustments !== undefined) {
    values.push(JSON.stringify(updates.adjustments))
    setClauses.push(`adjustments = $${String(values.length)}`)
  }
  if (updates.config !== undefined) {
    values.push(JSON.stringify(updates.config))
    setClauses.push(`config = $${String(values.length)}::jsonb`)
  }

  return { setClauses, values }
}

export class PostgresAvatarRepository implements IAvatarRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateAvatarParams): Promise<AvatarConfig> {
    const scenarioUuid = stripPrefix('scenario_', params.scenarioId)
    const mergedConfig = applyLlmOverride(params.config ?? {}, params.llmOverride)

    const [row] = await this.sql<[AvatarRow]>`
      INSERT INTO avatars (
        scenario_id, name, status,
        persona_prompt, tone, description, adjustments, config
      )
      VALUES (
        ${scenarioUuid},
        ${params.name},
        ${params.status ?? 'active'},
        ${params.personaPrompt},
        ${params.tone ?? null},
        ${params.description ?? null},
        ${params.adjustments ?? null},
        ${this.sql.json(mergedConfig as JSONValue)}
      )
      RETURNING
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, computed_traits, config, created_at, updated_at
    `
    return rowToAvatarConfig(row)
  }

  async findById(avatarId: string): Promise<AvatarConfig | null> {
    const uuid = extractUuid('avatar_', avatarId)
    if (uuid === null) return null
    const [row] = await this.sql<[AvatarRow?]>`
      SELECT
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, computed_traits, config, created_at, updated_at
      FROM avatars
      WHERE id = ${uuid}
    `
    return row ? rowToAvatarConfig(row) : null
  }

  async listByScenarioId(scenarioId: string): Promise<AvatarConfig[]> {
    const scenarioUuid = extractUuid('scenario_', scenarioId)
    if (scenarioUuid === null) return []

    const rows = await this.sql<AvatarRow[]>`
      SELECT
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, computed_traits, config, created_at, updated_at
      FROM avatars
      WHERE scenario_id = ${scenarioUuid}
      ORDER BY created_at DESC
    `
    return rows.map(rowToAvatarConfig)
  }

  async delete(avatarId: string): Promise<void> {
    const uuid = extractUuid('avatar_', avatarId)
    if (uuid === null) return
    await this.sql`
      DELETE FROM avatars
      WHERE id = ${uuid}
    `
  }

  async update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig> {
    const uuid = extractUuid('avatar_', avatarId)
    if (uuid === null) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }

    let nextConfig: Record<string, unknown> | undefined = updates.config

    if (updates.llmOverride !== undefined) {
      const [row] = await this.sql<[Pick<AvatarRow, 'config'>?]>`
        SELECT config
        FROM avatars
        WHERE id = ${uuid}
      `
      if (row === undefined) {
        throw new DomainError('NOT_FOUND', 'Avatar not found')
      }

      nextConfig = applyLlmOverride(
        nextConfig ?? normalizeAvatarConfig(row.config),
        updates.llmOverride,
      )
    }

    const { setClauses, values } = buildUpdateSetClauses({
      ...updates,
      ...(nextConfig !== undefined ? { config: nextConfig } : {}),
    })

    values.push(uuid)
    const whereParam = `$${String(values.length)}`

    const query = `
      UPDATE avatars
      SET ${setClauses.join(', ')}
      WHERE id = ${whereParam}
      RETURNING
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, computed_traits, config, created_at, updated_at
    `

    const rows = await this.sql.unsafe<AvatarRow[]>(query, values as string[])
    const row = rows[0]
    if (row === undefined) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }
    return rowToAvatarConfig(row)
  }

  async saveComputedTraits(
    avatarId: string,
    computedTraits: AvatarComputedTraits | null,
  ): Promise<AvatarConfig> {
    const uuid = extractUuid('avatar_', avatarId)
    if (uuid === null) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }

    const [row] = await this.sql<[AvatarRow?]>`
      UPDATE avatars
      SET computed_traits = ${this.sql.json(computedTraits)}, updated_at = NOW()
      WHERE id = ${uuid}
      RETURNING
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, computed_traits, config, created_at, updated_at
    `
    if (row === undefined) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }
    return rowToAvatarConfig(row)
  }
}
