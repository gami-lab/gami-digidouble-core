import type { SessionSummary } from '@gami/shared'

export interface StartSessionInput {
  userId: string
  scenarioId: string
}

export type { SessionSummary }

export interface StartSessionOutput {
  session: SessionSummary
}
