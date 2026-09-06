import type { Sql } from 'postgres'
import type { IModelConfigRepository } from '../../../application/ports/IModelConfigRepository.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'

interface ModelConfigRow {
  config: unknown
  updated_at: Date
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function parseConfigPayload(payload: unknown): ModelConfig {
  const parsed = typeof payload === 'string' ? (JSON.parse(payload) as unknown) : payload
  const config = asRecord(parsed)
  const globalDefault = config === null ? null : asRecord(config['globalDefault'])
  const roleOverrides = config === null ? null : asRecord(config['roleOverrides'])
  const updatedAt = config === null ? null : config['updatedAt']

  if (
    globalDefault === null ||
    typeof globalDefault['provider'] !== 'string' ||
    typeof globalDefault['model'] !== 'string' ||
    roleOverrides === null ||
    typeof updatedAt !== 'string'
  ) {
    throw new Error('Invalid model_config payload in database.')
  }

  return {
    globalDefault: {
      provider: globalDefault['provider'] as ModelConfig['globalDefault']['provider'],
      model: globalDefault['model'],
    },
    roleOverrides: roleOverrides,
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
