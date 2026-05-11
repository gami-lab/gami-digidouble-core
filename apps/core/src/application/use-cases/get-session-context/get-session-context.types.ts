import type { SessionContextSnapshot } from '../../../domain/context/session-context.types.js'

export type GetSessionContextInput = {
  sessionId: string
}

export type GetSessionContextOutput = SessionContextSnapshot
