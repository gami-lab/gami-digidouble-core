import type { ListPublicScenariosResponse, PublicScenarioSummary } from '@gami/shared'
import { webRequest } from './client'

export async function listAvailableScenarios(): Promise<PublicScenarioSummary[]> {
  const payload = await webRequest<ListPublicScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios
}
