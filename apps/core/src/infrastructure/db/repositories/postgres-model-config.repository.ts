import type { Sql } from 'postgres'
import type { IModelConfigRepository } from '../../../application/ports/IModelConfigRepository.js'
import {
  isProviderName,
  type ModelConfig,
  type ModelOverride,
  type RoleOverrides,
} from '../../../domain/model-config/index.js'
import { isAllowedModelForProvider, isModelSelectionProviderName } from '@gami/shared'

interface ModelConfigRow {
  config: unknown
  updated_at: Date
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function parseProvider(value: unknown, field: string): ModelOverride['provider'] {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !isProviderName(value)) {
    throw new Error(`Invalid ${field}.provider payload in database.`)
  }
  return value
}

function parseModel(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}.model payload in database.`)
  }
  return value.trim()
}

function assertSupportedModel(
  provider: ModelOverride['provider'],
  model: string | undefined,
  field: string,
): void {
  if (provider === undefined || model === undefined || provider === 'null') return
  if (!isModelSelectionProviderName(provider) || !isAllowedModelForProvider(provider, model)) {
    throw new Error(`Unsupported production model in ${field}.`)
  }
}

function parseModelOverride(value: unknown, field: string): ModelOverride {
  const override = asRecord(value)
  if (override === null) throw new Error(`Invalid ${field} payload in database.`)

  const provider = parseProvider(override['provider'], field)
  const model = parseModel(override['model'], field)
  assertSupportedModel(provider, model, field)

  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
  }
}

function parseRoleOverrides(value: unknown): RoleOverrides {
  const overrides = asRecord(value)
  if (overrides === null) throw new Error('Invalid roleOverrides payload in database.')

  const roleOverrides: RoleOverrides = {}
  for (const role of ['avatar', 'gameMaster', 'memory'] as const) {
    if (overrides[role] !== undefined) {
      roleOverrides[role] = parseModelOverride(overrides[role], `roleOverrides.${role}`)
    }
  }
  return roleOverrides
}

function parseGlobalDefault(value: unknown): ModelConfig['globalDefault'] {
  const globalDefault = asRecord(value)
  if (globalDefault === null) throw new Error('Invalid globalDefault payload in database.')

  const provider = parseProvider(globalDefault['provider'], 'globalDefault')
  const model = parseModel(globalDefault['model'], 'globalDefault')
  if (provider === undefined || model === undefined) {
    throw new Error('Invalid globalDefault payload in database.')
  }
  assertSupportedModel(provider, model, 'globalDefault.model')
  return { provider, model }
}

function parseConfigPayload(payload: unknown): ModelConfig {
  const parsed = typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload
  const config = asRecord(parsed)
  if (config === null) {
    throw new Error('Invalid model_config payload in database.')
  }

  const globalDefault = parseGlobalDefault(config['globalDefault'])
  const roleOverrides = parseRoleOverrides(config['roleOverrides'])
  const updatedAt = config['updatedAt']
  if (typeof updatedAt !== 'string') throw new Error('Invalid model_config payload in database.')

  return {
    globalDefault,
    roleOverrides,
    updatedAt,
  }
}

function rowToModelConfig(row: ModelConfigRow): ModelConfig {
  const parsedConfig = parseConfigPayload(row.config)

  return {
    globalDefault: parsedConfig.globalDefault,
    roleOverrides: parsedConfig.roleOverrides,
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresModelConfigRepository implements IModelConfigRepository {
  constructor(private readonly sql: Sql) {}

  async get(): Promise<ModelConfig | null> {
    const [row] = await this.sql<[ModelConfigRow?]>`
      SELECT config, updated_at
      FROM model_config
      WHERE id = 1
    `

    return row === undefined ? null : rowToModelConfig(row)
  }

  async upsert(config: ModelConfig): Promise<ModelConfig> {
    const serializedConfig = JSON.stringify(config)

    const [row] = await this.sql<[ModelConfigRow]>`
      INSERT INTO model_config (id, config)
      VALUES (1, ${serializedConfig}::JSONB)
      ON CONFLICT (id)
      DO UPDATE SET
        config = EXCLUDED.config,
        updated_at = NOW()
      RETURNING config, updated_at
    `

    return rowToModelConfig(row)
  }
}
