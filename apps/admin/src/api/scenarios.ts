import type {
  AvatarSummary,
  CreateAvatarRequest,
  CreateAvatarResponse,
  CreateScenarioRequest,
  CreateScenarioResponse,
  DeleteAvatarResponse,
  GetScenarioResponse,
  ListScenarioAvatarsResponse,
  ListScenariosResponse,
  PrepareAvatarTraitsResponse,
  ScenarioSummary,
  UpdateAvatarRequest,
  UpdateAvatarResponse,
  UpdateScenarioRequest,
  UpdateScenarioResponse,
} from '@gami/shared'
import { adminRequest } from './client'

export type { AvatarSummary, ScenarioSummary }

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const payload = await adminRequest<ListScenariosResponse>('GET', '/v1/scenarios')
  return payload.scenarios
}

export async function getScenario(scenarioId: string): Promise<ScenarioSummary> {
  const payload = await adminRequest<GetScenarioResponse>('GET', `/v1/scenarios/${scenarioId}`)
  return payload.scenario
}

export async function createScenario(input: CreateScenarioRequest): Promise<ScenarioSummary> {
  const payload = await adminRequest<CreateScenarioResponse>('POST', '/v1/scenarios', input)
  return payload.scenario
}

export async function updateScenario(
  scenarioId: string,
  input: UpdateScenarioRequest,
): Promise<ScenarioSummary> {
  const payload = await adminRequest<UpdateScenarioResponse>(
    'PATCH',
    `/v1/scenarios/${scenarioId}`,
    input,
  )
  return payload.scenario
}

export async function listScenarioAvatars(scenarioId: string): Promise<AvatarSummary[]> {
  const payload = await adminRequest<ListScenarioAvatarsResponse>(
    'GET',
    `/v1/scenarios/${scenarioId}/avatars`,
  )
  return payload.avatars
}

export async function createAvatar(
  scenarioId: string,
  input: CreateAvatarRequest,
): Promise<AvatarSummary> {
  const payload = await adminRequest<CreateAvatarResponse>(
    'POST',
    `/v1/scenarios/${scenarioId}/avatars`,
    input,
  )
  return payload.avatar
}

export async function updateAvatar(
  avatarId: string,
  input: UpdateAvatarRequest,
): Promise<AvatarSummary> {
  const payload = await adminRequest<UpdateAvatarResponse>(
    'PATCH',
    `/v1/avatars/${avatarId}`,
    input,
  )
  return payload.avatar
}

export async function deleteAvatar(avatarId: string): Promise<void> {
  await adminRequest<DeleteAvatarResponse>('DELETE', `/v1/avatars/${avatarId}`)
}

export async function prepareAvatarTraits(
  scenarioId: string,
): Promise<PrepareAvatarTraitsResponse> {
  return adminRequest<PrepareAvatarTraitsResponse>(
    'POST',
    `/v1/scenarios/${scenarioId}/prepare-avatar-traits`,
  )
}
