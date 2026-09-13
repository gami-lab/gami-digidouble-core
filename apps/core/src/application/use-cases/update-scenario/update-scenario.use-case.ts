import type { IScenarioRepository, UpdateScenarioParams } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { UpdateScenarioInput, UpdateScenarioOutput } from './update-scenario.types.js'
import { normalizeVoiceConfigurationMutation } from '../../../domain/voice/voice-configuration.js'
import { normalizeScenarioLanguage } from '../../../domain/scenario/scenario-language.js'

export class UpdateScenarioUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(input: UpdateScenarioInput): Promise<UpdateScenarioOutput> {
    const updates = buildUpdates(input)

    if (Object.keys(updates).length === 0) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const scenario = await this.scenarioRepository.update(input.scenarioId, updates)
    return { scenario }
  }
}

function buildUpdates(input: UpdateScenarioInput): UpdateScenarioParams {
  const {
    name,
    status,
    language,
    objectives,
    worldContext,
    avatarAvailability,
    modelSelection,
    config,
  } = input
  const normalizedLanguage = normalizeScenarioLanguage(language)
  const voiceConfig = normalizeVoiceConfigurationMutation(config, input.voiceConfig, true)

  return {
    ...(name !== undefined ? { name } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(normalizedLanguage !== undefined ? { language: normalizedLanguage } : {}),
    ...(objectives !== undefined ? { objectives } : {}),
    ...(worldContext !== undefined ? { worldContext } : {}),
    ...(avatarAvailability !== undefined ? { avatarAvailability } : {}),
    ...(modelSelection !== undefined ? { modelSelection } : {}),
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    ...(config !== undefined ? { config } : {}),
  }
}
