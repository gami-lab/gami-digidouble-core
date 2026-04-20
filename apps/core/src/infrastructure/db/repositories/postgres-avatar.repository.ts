import type { JSONValue, Sql } from 'postgres'
import type {
  CreateAvatarParams,
  IAvatarRepository,
} from '../../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

interface AvatarRow {
  id: string
  scenario_id: string
  name: string
  slug: string
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
    avatarId: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    slug: row.slug,
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
    const [row] = await this.sql<[AvatarRow]>`
      INSERT INTO avatars (
        scenario_id, name, slug, status,
        persona_prompt, tone, description, adjustments, config
      )
      VALUES (
        ${params.scenarioId},
        ${params.name},
        ${params.slug},
        ${params.status ?? 'active'},
        ${params.personaPrompt},
        ${params.tone ?? null},
        ${params.description ?? null},
        ${params.adjustments ?? null},
        ${this.sql.json((params.config ?? {}) as JSONValue)}
      )
      RETURNING
        id, scenario_id, name, slug, status,
        persona_prompt, tone, description, adjustments, config,
        created_at, updated_at
    `
    return rowToAvatarConfig(row)
  }

  async findById(avatarId: string): Promise<AvatarConfig | null> {
    const [row] = await this.sql<[AvatarRow?]>`
      SELECT
        id, scenario_id, name, slug, status,
        persona_prompt, tone, description, adjustments, config,
        created_at, updated_at
      FROM avatars
      WHERE id = ${avatarId}
    `
    return row ? rowToAvatarConfig(row) : null
  }
}
