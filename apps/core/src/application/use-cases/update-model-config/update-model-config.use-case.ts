import type {
  ModelConfig,
  ModelOverride,
  ProviderName,
  RoleOverrides,
} from '../../../domain/model-config/index.js'
import { isProviderName } from '../../../domain/model-config/index.js'
import { DomainError } from '../../../domain/errors.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'

export type UpdateModelConfigInput = {
  globalDefault: {
    provider: string
    model: string
  }
  roleOverrides?: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
}

export type UpdateModelConfigOutput = {
  modelConfig: ModelConfig
}

function assertNonEmptyModel(model: string, field: string): void {
  if (model.trim().length === 0) {
    throw new DomainError('INVALID_INPUT', `${field} must be a non-empty string`, {
      field,
    })
  }
}

function validateProvider(provider: string, field: string): ProviderName {
  if (!isProviderName(provider)) {
    throw new DomainError(
      'INVALID_INPUT',
      `${field} must be one of openai|anthropic|mistral|xai|null`,
      {
        field,
        provider,
      },
    )
  }

  return provider
}

function toModelOverride(
  override: { provider?: string; model?: string },
  field: string,
): ModelOverride {
  const provider =
    override.provider === undefined
      ? undefined
      : validateProvider(override.provider, `${field}.provider`)
  const model = override.model
  if (model !== undefined) {
    assertNonEmptyModel(model, `${field}.model`)
  }

  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model: model.trim() } : {}),
  }
}

function toRoleOverrides(input: UpdateModelConfigInput['roleOverrides']): RoleOverrides {
  if (input === undefined) return {}

  return {
    ...(input.avatar !== undefined
      ? { avatar: toModelOverride(input.avatar, 'roleOverrides.avatar') }
      : {}),
    ...(input.gameMaster !== undefined
      ? { gameMaster: toModelOverride(input.gameMaster, 'roleOverrides.gameMaster') }
      : {}),
    ...(input.memory !== undefined
      ? { memory: toModelOverride(input.memory, 'roleOverrides.memory') }
      : {}),
  }
}

export class UpdateModelConfigUseCase {
  constructor(private readonly modelConfigRepository: IModelConfigRepository) {}

  async execute(input: UpdateModelConfigInput): Promise<UpdateModelConfigOutput> {
    const provider = validateProvider(input.globalDefault.provider, 'globalDefault.provider')
    assertNonEmptyModel(input.globalDefault.model, 'globalDefault.model')

    const config: ModelConfig = {
      globalDefault: {
        provider,
        model: input.globalDefault.model.trim(),
      },
      roleOverrides: toRoleOverrides(input.roleOverrides),
      updatedAt: new Date().toISOString(),
    }

    const modelConfig = await this.modelConfigRepository.upsert(config)
    return { modelConfig }
  }
}
