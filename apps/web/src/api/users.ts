import type {
  UpsertUserPersonaApiResponse,
  UpsertUserPersonaRequest,
  UserSummary,
} from '@gami/shared'
import { webRequest } from './client'

export async function upsertUserPersona(
  userId: string,
  persona: UpsertUserPersonaRequest,
): Promise<UserSummary> {
  const payload = await webRequest<UpsertUserPersonaApiResponse>(
    'PUT',
    `/v1/users/${encodeURIComponent(userId)}/persona`,
    persona,
  )

  return payload.user
}
