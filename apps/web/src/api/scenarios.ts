import type { ScenarioSummary, ListScenariosResponse } from '@gami/shared'
import { webRequest } from './client'

export async function listAvailableScenarios(): Promise<ScenarioSummary[]> {
  const payload = await webRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios.filter((scenario) => scenario.status === 'active')
}
