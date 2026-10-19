import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { AvatarStatus } from '../../../domain/avatar/avatar.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { CreateAvatarInput, CreateAvatarOutput } from './create-avatar.types.js'
import { toAvatarSummary } from '../shared/avatar-summary.js'
import { normalizeVoiceConfigurationMutation } from '../../../domain/voice/voice-configuration.js'
import { applyPresentationMutation } from '../../../domain/presentation/presentation.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import { assertPresentationMedia } from '../../services/media/media-references.js'

const ALLOWED_AVATAR_STATUSES: ReadonlySet<AvatarStatus> = new Set(['draft', 'active', 'archived'])

export class CreateAvatarUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
  ) {}

  async execute(input: CreateAvatarInput): Promise<CreateAvatarOutput> {
    const normalized = normalizeAndValidateInput(input)
    const voiceConfig = normalizeVoiceConfigurationMutation(input.config, input.voiceConfig, false)
    const scenario = await this.scenarioRepository.findById(input.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }
    const config = await this.buildConfig(input, scenario.scenarioId)

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
      ...(config !== undefined ? { config } : {}),
    })

    return {
      avatar: toAvatarSummary(avatar),
    }
  }

  private async buildConfig(
    input: CreateAvatarInput,
    scenarioId: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (input.config === undefined && input.presentation === undefined) return undefined
    const config = applyPresentationMutation('avatar', input.config, {}, input.presentation)
    await assertPresentationMedia(this.mediaAssetRepository, 'avatar', scenarioId, config)
    return config
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

  const status = input.status ?? 'draft'
  if (!ALLOWED_AVATAR_STATUSES.has(status)) {
    throw new DomainError('VALIDATION_ERROR', 'status must be one of: draft, active, archived.')
  }
  if (status === 'active') {
    throw new DomainError('VALIDATION_ERROR', 'An Avatar must be prepared before it can be active.')
  }
  return { name, personaPrompt, status }
}
