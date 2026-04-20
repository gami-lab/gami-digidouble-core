import type { JSONValue, Sql } from 'postgres'
import type {
  CreateScenarioParams,
  IScenarioRepository,
} from '../../../application/ports/IScenarioRepository.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { extractUuid } from './id-prefix.js'

interface ScenarioRow {
  id: string
  name: string
  slug: string
  status: string
  config: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToScenario(row: ScenarioRow): Scenario {
  return {
    scenarioId: `scenario_${row.id}`,
    name: row.name,
    slug: row.slug,
    status: row.status as Scenario['status'],
    config: row.config as Scenario['config'],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresScenarioRepository implements IScenarioRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateScenarioParams): Promise<Scenario> {
    const [row] = await this.sql<[ScenarioRow]>`
      INSERT INTO scenarios (name, slug, status, config)
      VALUES (
        ${params.name},
        ${params.slug},
        ${params.status ?? 'draft'},
        ${this.sql.json((params.config ?? {}) as JSONValue)}
      )
      RETURNING id, name, slug, status, config, created_at, updated_at
    `
    return rowToScenario(row)
  }

  async findById(scenarioId: string): Promise<Scenario | null> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) return null
    const [row] = await this.sql<[ScenarioRow?]>`
      SELECT id, name, slug, status, config, created_at, updated_at
      FROM scenarios
      WHERE id = ${uuid}
    `
    return row ? rowToScenario(row) : null
  }
}
