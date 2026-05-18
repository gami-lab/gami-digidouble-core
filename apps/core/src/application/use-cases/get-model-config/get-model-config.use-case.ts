import type { ModelConfig } from '../../../domain/model-config/index.js'
import { DEFAULT_MODEL_CONFIG } from '../../../domain/model-config/index.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'

export type GetModelConfigOutput = {
  modelConfig: ModelConfig
}

export class GetModelConfigUseCase {
  constructor(private readonly modelConfigRepository: IModelConfigRepository) {}

  async execute(): Promise<GetModelConfigOutput> {
    const modelConfig = (await this.modelConfigRepository.get()) ?? DEFAULT_MODEL_CONFIG
    return { modelConfig }
  }
}
