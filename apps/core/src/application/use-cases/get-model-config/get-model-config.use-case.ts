import type { ModelConfig } from '../../../domain/model-config/index.js'
import { DEFAULT_MODEL_CONFIG } from '../../../domain/model-config/index.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'

export type GetModelConfigOutput = {
  modelConfig: ModelConfig
}

export class GetModelConfigUseCase {
  constructor(
    private readonly modelConfigRepository: IModelConfigRepository,
    private readonly modelConfigFallback?: ModelConfig,
  ) {}

  async execute(): Promise<GetModelConfigOutput> {
    const modelConfig =
      (await this.modelConfigRepository.get()) ?? this.modelConfigFallback ?? DEFAULT_MODEL_CONFIG
    return { modelConfig }
  }
}
