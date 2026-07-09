import type { ScenarioSummary } from '@gami/shared'

export type ScenarioDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; scenario: ScenarioSummary }
