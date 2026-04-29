import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { AvatarStatus } from '../../../domain/avatar/avatar.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { AvatarSummary } from '@gami/shared'
import type { CreateAvatarInput, CreateAvatarOutput } from './create-avatar.types.js'

const ALLOWED_AVATAR_STATUSES: ReadonlySet<AvatarStatus> = new Set(['draft', 'active', 'archived'])

export class CreateAvatarUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: CreateAvatarInput): Promise<CreateAvatarOutput> {
    const normalized = normalizeAndValidateInput(input)

    const scenario = await this.scenarioRepository.findById(input.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }

    const avatar = await this.avatarRepository.create({
      scenarioId: scenario.scenarioId,
      name: normalized.name,
      personaPrompt: normalized.personaPrompt,
      status: normalized.status,
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.adjustments !== undefined ? { adjustments: input.adjustments } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      ...(input.availabilityKey !== undefined ? { availabilityKey: input.availabilityKey } : {}),
    })

    return {
      avatar: mapAvatarOutput(avatar),
    }
  }
}

function normalizeAndValidateInput(input: CreateAvatarInput): {
  name: string
  personaPrompt: string
  status: AvatarStatus
} {
  const name = input.name.trim()
  const personaPrompt = input.personaPrompt.trim()

  if (name.length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'name must be a non-empty string.')
  }
  if (personaPrompt.length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'personaPrompt must be a non-empty string.')
  }

  const status = input.status ?? 'active'
  if (!ALLOWED_AVATAR_STATUSES.has(status)) {
    throw new DomainError('VALIDATION_ERROR', 'status must be one of: draft, active, archived.')
  }

  return { name, personaPrompt, status }
}

function mapAvatarOutput(avatar: Awaited<ReturnType<IAvatarRepository['create']>>): AvatarSummary {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    config: avatar.config,
    ...(avatar.availabilityKey !== undefined ? { availabilityKey: avatar.availabilityKey } : {}),
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}
