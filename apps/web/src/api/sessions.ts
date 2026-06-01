import type {
  AvailableAvatarSummary,
  GetAvailableAvatarsApiResponse,
  ListSessionsResponse,
  StartSessionRequest,
  StartSessionResponse,
  SessionSummary,
} from '@gami/shared'
import { webRequest } from './client'

export async function listActiveSessionsForScenario(query: {
  scenarioId: string
  userId: string
}): Promise<SessionSummary[]> {
  const params = new URLSearchParams()
  params.set('status', 'active')
  params.set('scenarioId', query.scenarioId)
  params.set('userId', query.userId)

  const payload = await webRequest<ListSessionsResponse>('GET', `/v1/sessions?${params.toString()}`)
  return payload.sessions
}

export async function startSession(request: StartSessionRequest): Promise<SessionSummary> {
  const payload = await webRequest<StartSessionResponse>('POST', '/v1/sessions', request)
  return payload.session
}

export async function ensureActiveSession(request: StartSessionRequest): Promise<SessionSummary> {
  const existingSessions = await listActiveSessionsForScenario({
    scenarioId: request.scenarioId,
    userId: request.userId,
  })

  const existingSession = existingSessions[0]
  if (existingSession !== undefined) {
    return existingSession
  }

  return startSession(request)
}

export async function getAvailableAvatarsForSession(
  sessionId: string,
  scenarioId: string,
): Promise<AvailableAvatarSummary[]> {
  const payload = await webRequest<GetAvailableAvatarsApiResponse>(
    'GET',
    `/v1/sessions/${sessionId}/available-avatars`,
  )

  return payload.avatars.filter((avatar) => avatar.scenarioId === scenarioId)
}
