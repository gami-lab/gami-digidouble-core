import type {
  CreateScenarioParams,
  IScenarioRepository,
} from '../../application/ports/IScenarioRepository.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'

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
      config: (params.config ?? {}) as Scenario['config'],
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
}
