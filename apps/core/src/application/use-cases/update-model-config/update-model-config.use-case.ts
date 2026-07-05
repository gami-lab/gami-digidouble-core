import type { UpdateModelConfigRequest } from '@gami/shared'
import type {
  ModelConfig,
  ModelOverride,
  ProviderName,
  RoleOverrides,
} from '../../../domain/model-config/index.js'
import { isProviderName, PROVIDER_NAMES } from '../../../domain/model-config/index.js'
import { DomainError } from '../../../domain/errors.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'

/** Wire request body for `PUT /v1/admin/model-config`; canonical shape owned by `@gami/shared`. */
export type UpdateModelConfigInput = UpdateModelConfigRequest

export type UpdateModelConfigOutput = {
  modelConfig: ModelConfig
}

const MAX_MODEL_LENGTH = 200

function assertNonEmptyModel(model: string, field: string): void {
  const normalized = model.trim()
  if (normalized.length === 0) {
    throw new DomainError('INVALID_INPUT', `${field} must be a non-empty string`, {
      field,
    })
  }
  if (normalized.length > MAX_MODEL_LENGTH) {
    throw new DomainError(
      'INVALID_INPUT',
      `${field} must be at most ${String(MAX_MODEL_LENGTH)} characters`,
      { field, maxLength: MAX_MODEL_LENGTH },
    )
  }
}

function validateProvider(provider: string, field: string): ProviderName {
  if (!isProviderName(provider)) {
    throw new DomainError('INVALID_INPUT', `${field} must be one of ${PROVIDER_NAMES.join('|')}`, {
      field,
      provider,
    })
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
  if (Array.isArray(input)) {
    throw new DomainError('INVALID_INPUT', 'roleOverrides must be an object')
  }

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
