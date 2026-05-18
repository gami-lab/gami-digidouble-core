import type { IModelConfigRepository } from '../../application/ports/IModelConfigRepository.js'
import type { ModelConfig } from '../../domain/model-config/index.js'

export class InMemoryModelConfigRepository implements IModelConfigRepository {
  constructor(private config: ModelConfig | null = null) {}

  get(): Promise<ModelConfig | null> {
    return Promise.resolve(this.config)
  }

  upsert(config: ModelConfig): Promise<ModelConfig> {
    this.config = { ...config }
    return Promise.resolve(this.config)
  }
}
