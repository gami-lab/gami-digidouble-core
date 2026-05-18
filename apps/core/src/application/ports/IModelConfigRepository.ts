import type { ModelConfig } from '../../domain/model-config/index.js'

export interface IModelConfigRepository {
  get(): Promise<ModelConfig | null>
  upsert(config: ModelConfig): Promise<ModelConfig>
}
