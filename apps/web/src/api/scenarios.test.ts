import { describe, expect, it } from 'vitest'
import type { ScenarioSummary } from '@gami/shared'
import { filterActiveScenarios } from './scenarios'

describe('scenario visibility filters', () => {
  it('keeps only active scenarios for the public surface', () => {
    const scenarios: ScenarioSummary[] = [
      createScenario('scenario_a', 'active'),
      createScenario('scenario_b', 'draft'),
      createScenario('scenario_c', 'archived'),
      createScenario('scenario_d', 'active'),
    ]

    expect(filterActiveScenarios(scenarios).map((scenario) => scenario.scenarioId)).toEqual([
      'scenario_a',
      'scenario_d',
    ])
  })
})

function createScenario(scenarioId: string, status: ScenarioSummary['status']): ScenarioSummary {
  return {
    scenarioId,
    name: `Scenario ${scenarioId}`,
    status,
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}
