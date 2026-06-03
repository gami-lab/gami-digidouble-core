import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <section className="discovery-section" aria-labelledby="scenarios-title">
      <h2 id="scenarios-title">{t('scenarios.title')}</h2>
      {scenarioStatus === 'loading' ? <p className="muted">{t('scenarios.loading')}</p> : null}
      {scenarioStatus === 'error' ? (
        <p className="error">{scenarioError ?? t('scenarios.error')}</p>
      ) : null}
      {scenarioStatus === 'ready' && scenarios.length === 0 ? (
        <p className="muted">{t('scenarios.empty')}</p>
      ) : null}

      {scenarioStatus === 'ready' && scenarios.length > 0 ? (
        <div className="scenario-grid" role="list" aria-label={t('scenarios.ariaLabel')}>
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
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
