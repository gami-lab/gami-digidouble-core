import type { AdminSessionContextResponse } from '@gami/shared'
import type { SessionContextSnapshot } from '../../../domain/context/session-context.types.js'

/**
 * Boundary mapper.
 *
 * Ownership:
 * - Internal context engine snapshot: domain/context/session-context.types.ts
 * - Public admin context DTO: @gami/shared AdminSessionContextResponse
 */
export function toAdminSessionContextResponse(
  snapshot: SessionContextSnapshot,
): AdminSessionContextResponse {
  return {
    sessionId: snapshot.sessionId,
    avatarContext: snapshot.avatarContext,
    gmContext: snapshot.gmContext,
  }
}
