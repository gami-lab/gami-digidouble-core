import type { JSONValue, Sql } from 'postgres'
import type {
  CreateAvatarParams,
  IAvatarRepository,
} from '../../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
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
  config: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToAvatarConfig(row: AvatarRow): AvatarConfig {
  return {
    avatarId: `avatar_${row.id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    name: row.name,
    status: row.status as AvatarConfig['status'],
    personaPrompt: row.persona_prompt,
    ...(row.tone !== null ? { tone: row.tone } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.adjustments !== null ? { adjustments: row.adjustments } : {}),
    config: row.config,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresAvatarRepository implements IAvatarRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateAvatarParams): Promise<AvatarConfig> {
    const scenarioUuid = stripPrefix('scenario_', params.scenarioId)
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
        ${this.sql.json((params.config ?? {}) as JSONValue)}
      )
      RETURNING
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, config,
        created_at, updated_at
    `
    return rowToAvatarConfig(row)
  }

  async findById(avatarId: string): Promise<AvatarConfig | null> {
    const uuid = extractUuid('avatar_', avatarId)
    if (uuid === null) return null
    const [row] = await this.sql<[AvatarRow?]>`
      SELECT
        id, scenario_id, name, status,
        persona_prompt, tone, description, adjustments, config,
        created_at, updated_at
      FROM avatars
      WHERE id = ${uuid}
    `
    return row ? rowToAvatarConfig(row) : null
  }
}
