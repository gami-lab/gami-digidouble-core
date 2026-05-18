import type { Sql } from 'postgres'
import type { IModelConfigRepository } from '../../../application/ports/IModelConfigRepository.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'

interface ModelConfigRow {
  config: ModelConfig
  updated_at: Date
}

function rowToModelConfig(row: ModelConfigRow): ModelConfig {
  return {
    globalDefault: row.config.globalDefault,
    roleOverrides: row.config.roleOverrides,
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
