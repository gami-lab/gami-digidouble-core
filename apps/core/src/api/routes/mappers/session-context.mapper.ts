import type { AdminSessionContextResponse } from '@gami/shared'
import type { GetSessionContextOutput } from '../../../application/use-cases/get-session-context/get-session-context.types.js'

export function toAdminSessionContextResponse(
  snapshot: GetSessionContextOutput,
): AdminSessionContextResponse {
  return snapshot
}
