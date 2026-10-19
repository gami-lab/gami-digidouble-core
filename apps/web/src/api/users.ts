import type {
  GetUserPersonaResponse,
  UpsertUserPersonaApiResponse,
  UpsertUserPersonaRequest,
  UserSummary,
} from '@gami/shared'
import { webRequest } from './client'

export async function upsertUserPersona(persona: UpsertUserPersonaRequest): Promise<UserSummary> {
  const payload = await webRequest<UpsertUserPersonaApiResponse>('PUT', '/v1/me/persona', persona)
  return payload.user
}

/** Sets one persona field while keeping the others (the persona route replaces the whole object). */
export async function updateUserPersonaField(
  field: keyof UpsertUserPersonaRequest,
  value: string,
): Promise<UserSummary> {
  const current = await webRequest<GetUserPersonaResponse>('GET', '/v1/me/persona')
  return upsertUserPersona({ ...(current.persona ?? {}), [field]: value })
}
