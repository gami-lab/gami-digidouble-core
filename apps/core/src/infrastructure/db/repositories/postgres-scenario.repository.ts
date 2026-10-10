import type { Sql } from 'postgres'
import {
  isModelSelectionProviderName,
  SCENARIO_MODEL_SLOTS,
  type ModelProfile,
  type ScenarioModelSelection,
} from '@gami/shared'
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
import {
  applyVoiceConfiguration,
  readVoiceConfiguration,
  withoutVoiceConfiguration,
} from '../../../domain/voice/voice-configuration.js'
import { toJsonValue } from '../json-value.js'

interface ScenarioRow {
  id: string
  name: string
  status: string
  language: string | null
  objectives: string[] | null
  world_context: string | null
  avatar_availability: unknown
  config: unknown
  model_selection: unknown
  created_at: Date
  updated_at: Date
}

function normalizeConfig(config: unknown): Record<string, unknown> {
  return isRecord(config) ? config : {}
}

function readModelProfile(value: unknown): ModelProfile | undefined {
  if (!isRecord(value)) return undefined
  const provider = value['provider']
  const model = value['model']
  if (typeof provider !== 'string' || typeof model !== 'string') return undefined
  if (!isModelSelectionProviderName(provider)) return undefined
  return { provider, model }
}

function readScenarioModelSelection(value: unknown): ScenarioModelSelection | undefined {
  if (!isRecord(value)) return undefined

  const selection: ScenarioModelSelection = {}
  for (const slot of SCENARIO_MODEL_SLOTS) {
    const profile = readModelProfile(value[slot])
    if (profile !== undefined) selection[slot] = profile
  }
  return Object.keys(selection).length > 0 ? selection : undefined
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
  // Pass the value itself: postgres.js already JSON-encodes jsonb parameters.
  values.push(value)
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
  if (updates.language !== undefined) {
    appendUpdateValue(setClauses, values, 'language', updates.language)
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
  if (!isRecord(value)) return { initialAvatarIds: [] }

  const initialAvatarIds = Array.isArray(value['initialAvatarIds'])
    ? (value['initialAvatarIds'] as unknown[]).filter((id): id is string => typeof id === 'string')
    : []
  const unlockableAvatarIds = Array.isArray(value['unlockableAvatarIds'])
    ? (value['unlockableAvatarIds'] as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : undefined

  return {
    initialAvatarIds,
    ...(unlockableAvatarIds !== undefined ? { unlockableAvatarIds } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rowToScenario(row: ScenarioRow): Scenario {
  const modelSelection = readScenarioModelSelection(row.model_selection)
  const rawConfig = normalizeConfig(row.config)
  const voiceConfig = readVoiceConfiguration(rawConfig)
  return {
    scenarioId: `scenario_${row.id}`,
    name: row.name,
    status: row.status as Scenario['status'],
    ...(row.language !== null ? { language: row.language } : {}),
    objectives: row.objectives ?? [],
    worldContext: row.world_context ?? '',
    avatarAvailability: normalizeAvatarAvailability(row.avatar_availability),
    ...(modelSelection !== undefined ? { modelSelection } : {}),
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    config: withoutVoiceConfiguration(rawConfig),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresScenarioRepository implements IScenarioRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateScenarioParams): Promise<Scenario> {
    const config = applyVoiceConfiguration(params.config ?? {}, params.voiceConfig)
    const [row] = await this.sql<[ScenarioRow]>`
      INSERT INTO scenarios (name, status, language, objectives, world_context, avatar_availability, config, model_selection)
      VALUES (
        ${params.name},
        ${params.status ?? 'draft'},
        ${params.language ?? null},
        ${params.objectives ?? []},
        ${params.worldContext ?? ''},
        ${this.sql.json(toJsonValue(params.avatarAvailability ?? { initialAvatarIds: [] }))},
        ${this.sql.json(toJsonValue(config))},
        ${this.sql.json(params.modelSelection ?? null)}
      )
      RETURNING id, name, status, language, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
    `
    return rowToScenario(row)
  }

  async findById(scenarioId: string): Promise<Scenario | null> {
    const uuid = extractUuid('scenario_', scenarioId)
    if (uuid === null) return null
    const [row] = await this.sql<[ScenarioRow?]>`
      SELECT id, name, status, language, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
      FROM scenarios
      WHERE id = ${uuid}
    `
    return row ? rowToScenario(row) : null
  }

  async list(): Promise<Scenario[]> {
    const rows = await this.sql<ScenarioRow[]>`
      SELECT id, name, status, language, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
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

    let nextConfig = updates.config
    if (updates.voiceConfig !== undefined || updates.config !== undefined) {
      const [row] = await this.sql<[Pick<ScenarioRow, 'config'>?]>`
        SELECT config
        FROM scenarios
        WHERE id = ${uuid}
      `
      if (row === undefined) {
        throw new DomainError('NOT_FOUND', 'Scenario not found')
      }
      const existingConfig = normalizeConfig(row.config)
      const voiceConfig =
        updates.voiceConfig === undefined
          ? readVoiceConfiguration(existingConfig)
          : updates.voiceConfig
      nextConfig = applyVoiceConfiguration(nextConfig ?? existingConfig, voiceConfig)
    }

    const { setClauses, values } = buildScenarioSetClauses({
      ...updates,
      ...(nextConfig !== undefined ? { config: nextConfig } : {}),
    })
    values.push(uuid)
    const whereParam = `$${String(values.length)}`

    const query = `
      UPDATE scenarios
      SET ${setClauses.join(', ')}
      WHERE id = ${whereParam}
      RETURNING id, name, status, language, objectives, world_context, avatar_availability, config, model_selection, created_at, updated_at
    `

    const rows = await this.sql.unsafe(query, values as string[])
    const row = rows[0] as ScenarioRow | undefined
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }
    return rowToScenario(row)
  }
}
