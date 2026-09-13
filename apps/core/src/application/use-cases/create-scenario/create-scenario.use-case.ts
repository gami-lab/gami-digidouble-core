import type { CreateScenarioParams, IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { CreateScenarioInput, CreateScenarioOutput } from './create-scenario.types.js'
import { normalizeVoiceConfigurationMutation } from '../../../domain/voice/voice-configuration.js'
import { toScenarioSummary } from '../shared/scenario-summary.js'
import { normalizeScenarioLanguage } from '../../../domain/scenario/scenario-language.js'

const ALLOWED_SCENARIO_STATUSES: ReadonlySet<CreateScenarioOutput['scenario']['status']> = new Set([
  'draft',
  'active',
  'archived',
])

export class CreateScenarioUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(input: CreateScenarioInput): Promise<CreateScenarioOutput> {
    const scenario = await this.scenarioRepository.create(buildCreateParams(input))

    return {
      scenario: toScenarioSummary(scenario),
    }
  }
}

// eslint-disable-next-line complexity
function buildCreateParams(input: CreateScenarioInput): CreateScenarioParams {
  const name = input.name.trim()
  if (name.length === 0) {
    throw new DomainError('VALIDATION_ERROR', 'name must be a non-empty string.')
  }

  const status = input.status ?? 'draft'
  if (!ALLOWED_SCENARIO_STATUSES.has(status)) {
    throw new DomainError('VALIDATION_ERROR', 'status must be one of: draft, active, archived.')
  }

  const language = normalizeScenarioLanguage(input.language ?? 'en')

  const voiceConfig = normalizeVoiceConfigurationMutation(input.config, input.voiceConfig, false)
  return {
    name,
    status,
    ...(language !== undefined ? { language } : {}),
    objectives: input.objectives ?? [],
    worldContext: input.worldContext ?? '',
    avatarAvailability: input.avatarAvailability ?? { initialAvatarIds: [] },
    ...(input.modelSelection !== undefined ? { modelSelection: input.modelSelection } : {}),
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    ...(input.config !== undefined ? { config: input.config } : {}),
  }
}
