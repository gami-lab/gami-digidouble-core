import type { SessionSummary } from '@gami/shared'

export interface StartSessionInput {
  userId: string
  scenarioId: string
  avatarOptions?: SessionSummary['avatarOptions']
}

export type { SessionSummary }

export interface StartSessionOutput {
  session: SessionSummary
}
