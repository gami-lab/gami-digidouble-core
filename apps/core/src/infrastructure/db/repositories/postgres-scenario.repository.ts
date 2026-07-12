import type { JSONValue, Sql } from 'postgres'
import { isModelSelectionProviderName, type ScenarioModelSelection } from '@gami/shared'
import type {
  CreateScenarioParams,
  IScenarioRepository,
  UpdateScenarioParams,
} from '../../../application/ports/IScenarioRepository.js'
import type {
  Scenario,
  ScenarioAvatarAvailabilityConfig,
} from '../../../domain/scenario/scenario.types.js'
import { DomainError } from '../../../domain/errors.js'
import { extractUuid } from './id-prefix.js'

interface ScenarioRow {
  id: string
  name: string
  status: string
  objectives: string[] | null
  world_context: string | null
  avatar_availability: unknown
  config: unknown
  model_selection: unknown
  created_at: Date
  updated_at: Date
}

function normalizeConfig(config: unknown): Scenario['config'] {
  if (isRecord(config)) {
    return config as Scenario['config']
  }
  if (typeof config === 'string') {
    try {
      const parsed: unknown = JSON.parse(config)
      return isRecord(parsed) ? (parsed as Scenario['config']) : {}
    } catch {
      return {}
    }
  }
  return {}
}

function readModelProfile(value: unknown): ScenarioModelSelection['defaultProfile'] | undefined {
  if (!isRecord(value)) return undefined
  const provider = value['provider']
  const model = value['model']
  if (typeof provider !== 'string' || typeof model !== 'string') return undefined
  if (!isModelSelectionProviderName(provider)) return undefined
  return { provider, model }
}

function readScenarioModelSelection(value: unknown): ScenarioModelSelection | undefined {
  const raw = isRecord(value) ? value : undefined
  if (raw === undefined) return undefined

  const defaultProfile = readModelProfile(raw['defaultProfile'])
  const gameMasterOverride = readModelProfile(raw['gameMasterOverride'])
  if (defaultProfile === undefined && gameMasterOverride === undefined) return undefined

  return {
    ...(defaultProfile !== undefined ? { defaultProfile } : {}),
    ...(gameMasterOverride !== undefined ? { gameMasterOverride } : {}),
  }
}

function appendUpdateValue(
  setClauses: string[],
  values: unknown[],
  column: string,
  value: unknown,
): void {
  values.push(value)
  setClauses.push(`${column} = $${String(values.length)}`)
}

function appendJsonbUpdateValue(
  setClauses: string[],
  values: unknown[],
  column: string,
  value: unknown,
): void {
  values.push(value === null ? null : JSON.stringify(value))
  setClauses.push(`${column} = $${String(values.length)}::jsonb`)
}

function buildScenarioSetClauses(updates: UpdateScenarioParams): {
  setClauses: string[]
  values: unknown[]
} {
  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []

  if (updates.name !== undefined) {
    appendUpdateValue(setClauses, values, 'name', updates.name)
  }
  if (updates.status !== undefined) {
    appendUpdateValue(setClauses, values, 'status', updates.status)
  }
  if (updates.objectives !== undefined) {
    appendUpdateValue(setClauses, values, 'objectives', updates.objectives)
  }
  if (updates.worldContext !== undefined) {
    appendUpdateValue(setClauses, values, 'world_context', updates.worldContext)
  }
  if (updates.avatarAvailability !== undefined) {
    appendJsonbUpdateValue(setClauses, values, 'avatar_availability', updates.avatarAvailability)
  }
  if (updates.config !== undefined) {
    appendJsonbUpdateValue(setClauses, values, 'config', updates.config)
  }
  if (updates.modelSelection !== undefined) {
    appendJsonbUpdateValue(setClauses, values, 'model_selection', updates.modelSelection)
  }

  return { setClauses, values }
}

function normalizeAvatarAvailability(value: unknown): ScenarioAvatarAvailabilityConfig {
  const parsed = typeof value === 'string' ? safeJsonParse(value) : value
  if (!isRecord(parsed)) return { initialAvatarIds: [] }

  const initialAvatarIds = Array.isArray(parsed['initialAvatarIds'])
    ? (parsed['initialAvatarIds'] as unknown[]).filter((id): id is string => typeof id === 'string')
    : []
  const unlockableAvatarIds = Array.isArray(parsed['unlockableAvatarIds'])
    ? (parsed['unlockableAvatarIds'] as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : undefined

  return {
    initialAvatarIds,
    ...(unlockableAvatarIds !== undefined ? { unlockableAvatarIds } : {}),
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rowToScenario(row: ScenarioRow): Scenario {
  const modelSelection = readScenarioModelSelection(row.model_selection)
  return {
    scenarioId: `scenario_${row.id}`,
    name: row.name,
    status: row.status as Scenario['status'],
    objectives: row.objectives ?? [],
    worldContext: row.world_context ?? '',
    avatarAvailability: normalizeAvatarAvailability(row.avatar_availability),
    ...(modelSelection !== undefined ? { modelSelection } : {}),
    config: normalizeConfig(row.config),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresScenarioRepository implements IScenarioRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateScenarioParams): Promise<Scenario> {
    const [row] = await this.sql<[ScenarioRow]>`
      INSERT INTO scenarios (name, status, objectives, world_context, avatar_availability, config, model_selection)
      VALUES (
        ${params.name},
        ${params.status ?? 'draft'},
        ${params.objectives ?? []},
        ${params.worldContext ?? ''},
        ${this.sql.json((params.avatarAvailability ?? { initialAvatarIds: [] }) as unknown as JSONValue)},
        ${this.sql.json((params.config ?? {}) as JSONValue)},
        ${this.sql.json((params.modelSelection ?? null) as unknown as JSONValue)}
      )
      RETURNING id, name, status, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
    `
    return rowToScenario(row)
  }

  async findById(scenarioId: string): Promise<Scenario | null> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) return null
    const [row] = await this.sql<[ScenarioRow?]>`
      SELECT id, name, status, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
      FROM scenarios
      WHERE id = ${uuid}
    `
    return row ? rowToScenario(row) : null
  }

  async list(): Promise<Scenario[]> {
    const rows = await this.sql<ScenarioRow[]>`
      SELECT id, name, status, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
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

  async update(scenarioId: string, updates: UpdateScenarioParams): Promise<Scenario> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }

    const { setClauses, values } = buildScenarioSetClauses(updates)
    values.push(uuid)
    const whereParam = `$${String(values.length)}`

    const query = `
      UPDATE scenarios
      SET ${setClauses.join(', ')}
      WHERE id = ${whereParam}
      RETURNING id, name, status, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
    `

    const rows = await this.sql.unsafe(query, values as string[])
    const row = rows[0] as ScenarioRow | undefined
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }
    return rowToScenario(row)
  }
}
