import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { ScenarioSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import { getScenario } from '../api/scenarios'
import type { ScenarioDetailState } from './scenario-detail-state'

type ScenarioDetailPageProps = {
  scenarioId: string
  onBack: () => void
}

export function ScenarioDetailPage({ scenarioId, onBack }: ScenarioDetailPageProps): JSX.Element {
  const [state, setState] = useState<ScenarioDetailState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    setState({ status: 'loading' })
    getScenario(scenarioId)
      .then((scenario) => {
        if (!cancelled) setState({ status: 'success', scenario })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: formatApiError(error, 'UNKNOWN_ERROR: Failed to load scenario'),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [scenarioId])

  return (
    <section className="admin-card">
      <button type="button" className="admin-link-button" onClick={onBack}>
        ← Back to scenarios
      </button>
      <ScenarioDetailBody state={state} />
    </section>
  )
}

function ScenarioDetailBody({ state }: { state: ScenarioDetailState }): JSX.Element {
  if (state.status === 'loading') {
    return <p>Loading scenario…</p>
  }

  if (state.status === 'error') {
    return <p className="admin-error">{state.message}</p>
  }

  return <ScenarioDetailSummary scenario={state.scenario} />
}

function ScenarioDetailSummary({ scenario }: { scenario: ScenarioSummary }): JSX.Element {
  return (
    <>
      <h2>{scenario.name}</h2>
      <p>
        <span className="admin-status-pill">{scenario.status}</span>
      </p>

      <h3>World context</h3>
      <p className="admin-muted">{scenario.worldContext || 'Not set.'}</p>

      <h3>Objectives</h3>
      {scenario.objectives.length === 0 ? (
        <p className="admin-muted">No objectives yet.</p>
      ) : (
        <ul>
          {scenario.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      )}

      <p className="admin-muted">
        Avatar, knowledge source, and model config editing arrive in later scenario-builder slices.
      </p>
    </>
  )
}
