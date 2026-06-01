import type { JSX } from 'react'
import type { ScenarioSummary } from '@gami/shared'

type ScenarioLoadStatus = 'loading' | 'ready' | 'error'

type ScenarioDiscoverySectionProps = {
  scenarios: ScenarioSummary[]
  scenarioStatus: ScenarioLoadStatus
  scenarioError: string | null
  selectedScenarioId: string | null
  onSelectScenario: (scenarioId: string) => void
}

export function ScenarioDiscoverySection({
  scenarios,
  scenarioStatus,
  scenarioError,
  selectedScenarioId,
  onSelectScenario,
}: ScenarioDiscoverySectionProps): JSX.Element {
  return (
    <section className="discovery-section" aria-labelledby="scenarios-title">
      <h2 id="scenarios-title">Available scenarios</h2>
      {scenarioStatus === 'loading' ? <p className="muted">Loading scenarios…</p> : null}
      {scenarioStatus === 'error' ? <p className="error">{scenarioError ?? 'Unable to load scenarios.'}</p> : null}
      {scenarioStatus === 'ready' && scenarios.length === 0 ? (
        <p className="muted">No active scenarios are available right now.</p>
      ) : null}

      {scenarioStatus === 'ready' && scenarios.length > 0 ? (
        <div className="scenario-grid" role="list" aria-label="Scenario list">
          {scenarios.map((scenario) => {
            const isSelected = scenario.scenarioId === selectedScenarioId
            const cardClassName = isSelected ? 'scenario-card scenario-card-selected' : 'scenario-card'

            return (
              <button
                key={scenario.scenarioId}
                type="button"
                className={cardClassName}
                onClick={() => {
                  onSelectScenario(scenario.scenarioId)
                }}
              >
                <span className="scenario-name">{scenario.name}</span>
                <span className="scenario-meta">Scenario ID: {scenario.scenarioId}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
