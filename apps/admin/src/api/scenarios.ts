import type { GetScenarioResponse, ListScenariosResponse, ScenarioSummary } from '@gami/shared'
import { adminRequest } from './client'

export type { ScenarioSummary }

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const payload = await adminRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios
}

export async function getScenario(scenarioId: string): Promise<ScenarioSummary> {
  const payload = await adminRequest<GetScenarioResponse>('GET', `/v1/scenarios/${scenarioId}`)
  return payload.scenario
}
