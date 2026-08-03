import type { ModelSelectionOverride, SessionSummary } from '@gami/shared'

export interface StartSessionInput {
  userId: string
  scenarioId: string
  modelOverride?: ModelSelectionOverride
  avatarOptions?: SessionSummary['avatarOptions']
}

export type { SessionSummary }

export interface StartSessionOutput {
  session: SessionSummary
}
