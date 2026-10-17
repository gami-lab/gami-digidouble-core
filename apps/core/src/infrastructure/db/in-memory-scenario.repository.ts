import { optionalField } from '../../domain/optional-field.js'
import type {
  CreateScenarioParams,
  IScenarioRepository,
  UpdateScenarioParams,
} from '../../application/ports/IScenarioRepository.js'
import type { ScenarioModelSelection } from '@gami/shared'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { DomainError } from '../../domain/errors.js'
import {
  applyVoiceConfiguration,
  readVoiceConfiguration,
  withoutVoiceConfiguration,
} from '../../domain/voice/voice-configuration.js'

function withoutModelSelection(scenario: Scenario): Omit<Scenario, 'modelSelection'> {
  const scenarioWithoutModelSelection = { ...scenario }
  delete scenarioWithoutModelSelection.modelSelection
  return scenarioWithoutModelSelection
}

function resolveNextModelSelection(
  existing: Scenario,
  updates: UpdateScenarioParams,
): ScenarioModelSelection | undefined {
  return updates.modelSelection !== undefined
    ? (updates.modelSelection ?? undefined)
    : existing.modelSelection
}

function resolveNextConfig(existing: Scenario, updates: UpdateScenarioParams): Scenario['config'] {
  const baseConfig = updates.config !== undefined ? updates.config : existing.config
  const voiceConfig = updates.voiceConfig === undefined ? existing.voiceConfig : updates.voiceConfig
  return withoutVoiceConfiguration(applyVoiceConfiguration(baseConfig, voiceConfig))
}

function normalizeInitialScenario(scenario: Scenario): Scenario {
  const voiceConfig = scenario.voiceConfig ?? readVoiceConfiguration(scenario.config)
  return {
    ...scenario,
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    config: withoutVoiceConfiguration(scenario.config),
  }
}

function buildUpdatedScenario(existing: Scenario, updates: UpdateScenarioParams): Scenario {
  const nextModelSelection = resolveNextModelSelection(existing, updates)
  const existingWithoutVoiceConfig = withoutModelSelection(existing)
  delete existingWithoutVoiceConfig.voiceConfig
  return {
    ...existingWithoutVoiceConfig,
    ...optionalField('name', updates.name),
    ...optionalField('status', updates.status),
    ...optionalField('language', updates.language),
    ...optionalField('objectives', updates.objectives),
    ...optionalField('worldContext', updates.worldContext),
    ...optionalField('avatarAvailability', updates.avatarAvailability),
    ...optionalField('modelSelection', nextModelSelection),
    ...optionalField(
      'voiceConfig',
      updates.voiceConfig === undefined ? existing.voiceConfig : updates.voiceConfig,
    ),
    config: resolveNextConfig(existing, updates),
    updatedAt: new Date().toISOString(),
  }
}

export class InMemoryScenarioRepository implements IScenarioRepository {
  private readonly scenarios: Map<string, Scenario>

  constructor(initialData: Scenario[] = []) {
    this.scenarios = new Map(
      initialData.map((scenario) => [scenario.scenarioId, normalizeInitialScenario(scenario)]),
    )
  }

  findById(scenarioId: string): Promise<Scenario | null> {
    return Promise.resolve(this.scenarios.get(scenarioId) ?? null)
  }

  list(): Promise<Scenario[]> {
    const scenarios = [...this.scenarios.values()].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    return Promise.resolve(scenarios)
  }

  create(params: CreateScenarioParams): Promise<Scenario> {
    const now = new Date().toISOString()
    const scenario: Scenario = {
      scenarioId: `scenario_${crypto.randomUUID()}`,
      name: params.name,
      status: params.status ?? 'draft',
      ...optionalField('language', params.language),
      objectives: params.objectives ?? [],
      worldContext: params.worldContext ?? '',
      avatarAvailability: params.avatarAvailability ?? { initialAvatarIds: [] },
      ...optionalField('modelSelection', params.modelSelection),
      ...optionalField('voiceConfig', params.voiceConfig),
      config: withoutVoiceConfiguration(
        applyVoiceConfiguration(params.config ?? {}, params.voiceConfig),
      ),
      createdAt: now,
      updatedAt: now,
    }

    this.scenarios.set(scenario.scenarioId, scenario)
    return Promise.resolve(scenario)
  }

  delete(scenarioId: string): Promise<void> {
    this.scenarios.delete(scenarioId)
    return Promise.resolve()
  }

  async update(scenarioId: string, updates: UpdateScenarioParams): Promise<Scenario> {
    const existing = this.scenarios.get(scenarioId)
    if (existing === undefined) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }
    const updated = buildUpdatedScenario(existing, updates)
    this.scenarios.set(scenarioId, updated)
    return Promise.resolve(updated)
  }
}
