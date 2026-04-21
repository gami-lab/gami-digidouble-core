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
  status: string
  config: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToScenario(row: ScenarioRow): Scenario {
  return {
    scenarioId: `scenario_${row.id}`,
    name: row.name,
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
      INSERT INTO scenarios (name, status, config)
      VALUES (
        ${params.name},
        ${params.status ?? 'draft'},
        ${this.sql.json((params.config ?? {}) as JSONValue)}
      )
      RETURNING id, name, status, config, created_at, updated_at
    `
    return rowToScenario(row)
  }

  async findById(scenarioId: string): Promise<Scenario | null> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) return null
    const [row] = await this.sql<[ScenarioRow?]>`
      SELECT id, name, status, config, created_at, updated_at
      FROM scenarios
      WHERE id = ${uuid}
    `
    return row ? rowToScenario(row) : null
  }

  async list(): Promise<Scenario[]> {
    const rows = await this.sql<ScenarioRow[]>`
      SELECT id, name, status, config, created_at, updated_at
      FROM scenarios
      ORDER BY created_at DESC
    `
    return rows.map(rowToScenario)
  }

  async delete(scenarioId: string): Promise<void> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) return
    await this.sql`
      DELETE FROM scenarios
      WHERE id = ${uuid}
    `
  }
}
