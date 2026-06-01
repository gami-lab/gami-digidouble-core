import { coreRequest } from './client'
import type {
  AvatarSummary,
  CreateAvatarForScenarioRequest,
  CreateAvatarResponse,
  CreateScenarioRequest,
  CreateScenarioResponse,
  DeleteAvatarResponse,
  DeleteScenarioResponse,
  ListScenarioAvatarsResponse,
  ListScenariosResponse,
  ScenarioStatus,
  ScenarioSummary,
  UpdateScenarioRequest,
  UpdateScenarioResponse,
  UpdateAvatarResponse,
  UpdateAvatarRequest,
} from '@gami/shared'

export type { AvatarSummary, ScenarioStatus, ScenarioSummary }

export type CreateScenarioParams = CreateScenarioRequest
export type CreateAvatarParams = CreateAvatarForScenarioRequest['avatar']

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const payload = await coreRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios
}

export async function listScenarioAvatars(scenarioId: string): Promise<AvatarSummary[]> {
  const payload = await coreRequest<ListScenarioAvatarsResponse>(
    'GET',
    `/v1/scenarios/${scenarioId}/avatars`,
  )
  return payload.avatars
}

export async function createScenario(
  params: CreateScenarioParams,
): Promise<CreateScenarioResponse['scenario']> {
  const payload = await coreRequest<CreateScenarioResponse>('POST', '/v1/scenarios', params)
  return payload.scenario
}

export async function createAvatar(
  scenarioId: string,
  params: CreateAvatarParams,
): Promise<AvatarSummary> {
  const payload = await coreRequest<CreateAvatarResponse>(
    'POST',
    `/v1/scenarios/${scenarioId}/avatars`,
    params,
  )

  return payload.avatar
}

export async function updateScenario(
  scenarioId: string,
  updates: UpdateScenarioRequest,
): Promise<ScenarioSummary> {
  const payload = await coreRequest<UpdateScenarioResponse>(
    'PATCH',
    `/v1/scenarios/${scenarioId}`,
    updates,
  )
  return payload.scenario
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await coreRequest<DeleteScenarioResponse>('DELETE', `/v1/scenarios/${scenarioId}`)
}

export async function updateAvatar(
  avatarId: string,
  updates: UpdateAvatarRequest,
): Promise<AvatarSummary> {
  const payload = await coreRequest<UpdateAvatarResponse>(
    'PATCH',
    `/v1/avatars/${avatarId}`,
    updates,
  )
  return payload.avatar
}

export async function deleteAvatar(avatarId: string): Promise<void> {
  await coreRequest<DeleteAvatarResponse>('DELETE', `/v1/avatars/${avatarId}`)
}
