import { coreRequest } from './client'
import type {
  AvatarSummary,
  GetScenarioResponse,
  ListScenarioAvatarsResponse,
  ListScenariosResponse,
  PrepareAvatarTraitsResponse,
  ScenarioSummary,
} from '@gami/shared'

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const payload = await coreRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios
}

export async function getScenario(scenarioId: string): Promise<ScenarioSummary> {
  const payload = await coreRequest<GetScenarioResponse>('GET', `/v1/scenarios/${scenarioId}`)
  return payload.scenario
}

export async function listScenarioAvatars(scenarioId: string): Promise<AvatarSummary[]> {
  const payload = await coreRequest<ListScenarioAvatarsResponse>(
    'GET',
    `/v1/scenarios/${scenarioId}/avatars`,
  )
  return payload.avatars
}

export async function prepareAvatarTraits(
  scenarioId: string,
): Promise<PrepareAvatarTraitsResponse> {
  return coreRequest<PrepareAvatarTraitsResponse>(
    'POST',
    `/v1/scenarios/${scenarioId}/prepare-avatar-traits`,
  )
}
