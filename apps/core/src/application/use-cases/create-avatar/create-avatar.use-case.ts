import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { AvatarStatus } from '../../../domain/avatar/avatar.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { CreateAvatarInput, CreateAvatarOutput } from './create-avatar.types.js'
import { toAvatarSummary } from '../shared/avatar-summary.js'
import { normalizeVoiceConfigurationMutation } from '../../../domain/voice/voice-configuration.js'

const ALLOWED_AVATAR_STATUSES: ReadonlySet<AvatarStatus> = new Set(['draft', 'active', 'archived'])

export class CreateAvatarUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: CreateAvatarInput): Promise<CreateAvatarOutput> {
    const normalized = normalizeAndValidateInput(input)
    const voiceConfig = normalizeVoiceConfigurationMutation(input.config, input.voiceConfig, false)

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
      ...(input.llmOverride !== undefined ? { llmOverride: input.llmOverride } : {}),
      ...(voiceConfig !== undefined ? { voiceConfig } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
    })

    return {
      avatar: toAvatarSummary(avatar),
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
