import type { SessionSummary } from '@gami/shared'

export interface GetSessionInput {
  sessionId: string
}

export type { SessionSummary }

export interface GetSessionOutput {
  session: SessionSummary
}
