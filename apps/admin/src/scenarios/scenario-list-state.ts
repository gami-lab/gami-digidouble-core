import type { ScenarioSummary } from '@gami/shared'

export type ScenarioListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; scenarios: ScenarioSummary[] }
