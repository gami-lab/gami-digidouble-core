import { coreRequest } from './client'

export type ScenarioStatus = 'draft' | 'active' | 'archived'

export type ScenarioSummary = {
  scenarioId: string
  name: string
  status: ScenarioStatus
  createdAt: string
  updatedAt: string
}

export type AvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: ScenarioStatus
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  createdAt: string
  updatedAt: string
}

export type CreateScenarioParams = {
  name: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

type CreateScenarioPayload = {
  scenario: ScenarioSummary & {
    config: Record<string, unknown>
  }
}

export type CreateAvatarParams = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: ScenarioStatus
}

type CreateAvatarPayload = {
  avatar: AvatarSummary
}

type UpdateScenarioPayload = {
  scenario: ScenarioSummary & { config: Record<string, unknown> }
}

type DeleteScenarioPayload = {
  scenarioId: string
  deleted: true
}

type UpdateAvatarPayload = {
  avatar: AvatarSummary
}

type DeleteAvatarPayload = {
  avatarId: string
  deleted: true
}

type ListScenariosPayload = {
  scenarios: ScenarioSummary[]
}

type ListScenarioAvatarsPayload = {
  avatars: AvatarSummary[]
}

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const payload = await coreRequest<ListScenariosPayload>('GET', '/v1/scenarios')
  return payload.scenarios
}

export async function listScenarioAvatars(scenarioId: string): Promise<AvatarSummary[]> {
  const payload = await coreRequest<ListScenarioAvatarsPayload>(
    'GET',
    `/v1/scenarios/${scenarioId}/avatars`,
  )
  return payload.avatars
}

export async function createScenario(
  params: CreateScenarioParams,
): Promise<CreateScenarioPayload['scenario']> {
  const payload = await coreRequest<CreateScenarioPayload>('POST', '/v1/scenarios', params)
  return payload.scenario
}

export async function createAvatar(
  scenarioId: string,
  params: CreateAvatarParams,
): Promise<AvatarSummary> {
  const payload = await coreRequest<CreateAvatarPayload>(
    'POST',
    `/v1/scenarios/${scenarioId}/avatars`,
    params,
  )

  return payload.avatar
}

export async function updateScenario(
  scenarioId: string,
  updates: Partial<Pick<ScenarioSummary, 'name' | 'status'>>,
): Promise<ScenarioSummary> {
  const payload = await coreRequest<UpdateScenarioPayload>(
    'PATCH',
    `/v1/scenarios/${scenarioId}`,
    updates,
  )
  return payload.scenario
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await coreRequest<DeleteScenarioPayload>('DELETE', `/v1/scenarios/${scenarioId}`)
}

export async function updateAvatar(
  avatarId: string,
  updates: Partial<Pick<AvatarSummary, 'name' | 'personaPrompt' | 'tone' | 'description' | 'status'>>,
): Promise<AvatarSummary> {
  const payload = await coreRequest<UpdateAvatarPayload>('PATCH', `/v1/avatars/${avatarId}`, updates)
  return payload.avatar
}

export async function deleteAvatar(avatarId: string): Promise<void> {
  await coreRequest<DeleteAvatarPayload>('DELETE', `/v1/avatars/${avatarId}`)
}
