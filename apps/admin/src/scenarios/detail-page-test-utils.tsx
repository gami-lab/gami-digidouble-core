import { render } from '@testing-library/react'
import type { JSX } from 'react'
import { useRoute } from '../routing/router'
import { ScenarioDetailPage } from './ScenarioDetailPage'

function RoutedScenarioDetailPage({ scenarioId }: { scenarioId: string }): JSX.Element {
  const route = useRoute()
  const mode =
    route.name === 'scenario-detail' && route.scenarioId === scenarioId ? route.mode : { kind: 'view' as const }
  return <ScenarioDetailPage scenarioId={scenarioId} mode={mode} />
}

// Renders the detail page at its own URL so mode changes go through real history navigation.
export function renderRoutedDetailPage(scenarioId = 'scenario_a'): void {
  window.history.replaceState(null, '', `/scenarios/${scenarioId}`)
  render(<RoutedScenarioDetailPage scenarioId={scenarioId} />)
}
