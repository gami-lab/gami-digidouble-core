import type {
  UpsertUserPersonaApiResponse,
  UpsertUserPersonaRequest,
  UserSummary,
} from '@gami/shared'
import { webRequest } from './client'

export async function upsertUserPersona(persona: UpsertUserPersonaRequest): Promise<UserSummary> {
  const payload = await webRequest<UpsertUserPersonaApiResponse>('PUT', '/v1/me/persona', persona)
  return payload.user
}
