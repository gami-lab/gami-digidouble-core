import type { ScenarioSummary, ListScenariosResponse } from '@gami/shared'
import { webRequest } from './client'

export async function listAvailableScenarios(): Promise<ScenarioSummary[]> {
  const payload = await webRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return filterActiveScenarios(payload.scenarios)
}

export function filterActiveScenarios(scenarios: ScenarioSummary[]): ScenarioSummary[] {
  return scenarios.filter((scenario) => scenario.status === 'active')
}
