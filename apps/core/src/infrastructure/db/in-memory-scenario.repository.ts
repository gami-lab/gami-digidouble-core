import type {
  CreateScenarioParams,
  IScenarioRepository,
  UpdateScenarioParams,
} from '../../application/ports/IScenarioRepository.js'
import type { ScenarioModelSelection } from '@gami/shared'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { DomainError } from '../../domain/errors.js'

function applyModelSelection(
  config: Scenario['config'],
  modelSelection: ScenarioModelSelection | null | undefined,
): Scenario['config'] {
  if (modelSelection === undefined) return config

  const nextConfig = { ...config }
  if (modelSelection === null) {
    delete nextConfig['modelSelection']
    return nextConfig
  }

  nextConfig['modelSelection'] = modelSelection
  return nextConfig
}

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
  return updates.config !== undefined || updates.modelSelection !== undefined
    ? applyModelSelection(updates.config ?? existing.config, updates.modelSelection)
    : existing.config
}

function buildUpdatedScenario(existing: Scenario, updates: UpdateScenarioParams): Scenario {
  const nextModelSelection = resolveNextModelSelection(existing, updates)
  return {
    ...withoutModelSelection(existing),
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.objectives !== undefined ? { objectives: updates.objectives } : {}),
    ...(updates.worldContext !== undefined ? { worldContext: updates.worldContext } : {}),
    ...(updates.avatarAvailability !== undefined
      ? { avatarAvailability: updates.avatarAvailability }
      : {}),
    ...(nextModelSelection !== undefined ? { modelSelection: nextModelSelection } : {}),
    config: resolveNextConfig(existing, updates),
    updatedAt: new Date().toISOString(),
  }
}

export class InMemoryScenarioRepository implements IScenarioRepository {
  private readonly scenarios: Map<string, Scenario>

  constructor(initialData: Scenario[] = []) {
    this.scenarios = new Map(initialData.map((scenario) => [scenario.scenarioId, scenario]))
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
      objectives: params.objectives ?? [],
      worldContext: params.worldContext ?? '',
      avatarAvailability: params.avatarAvailability ?? { initialAvatarIds: [] },
      ...(params.modelSelection !== undefined ? { modelSelection: params.modelSelection } : {}),
      config: applyModelSelection(params.config ?? {}, params.modelSelection),
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
