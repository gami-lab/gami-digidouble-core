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
