import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { ScenarioSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import { listScenarios } from '../api/scenarios'
import { Link } from '../routing/Link'
import { navigate, useDocumentTitle, type Route } from '../routing/router'
import type { ScenarioListState } from './scenario-list-state'

type ScenarioListPageProps = {
  onCreateScenario: () => void
}

export function ScenarioListPage({ onCreateScenario }: ScenarioListPageProps): JSX.Element {
  useDocumentTitle(['Scenarios'])
  const [state, setState] = useState<ScenarioListState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    setState({ status: 'loading' })
    listScenarios()
      .then((scenarios) => {
        if (!cancelled) setState({ status: 'success', scenarios })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: formatApiError(error, 'UNKNOWN_ERROR: Failed to load scenarios'),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="admin-card">
      <div className="admin-section-header">
        <h2>Scenarios</h2>
        <button
          type="button"
          className="admin-button admin-button-primary"
          onClick={onCreateScenario}
        >
          Create scenario
        </button>
      </div>
      <p className="admin-muted">Select a scenario to view its details.</p>
      <ScenarioListBody state={state} />
    </section>
  )
}

function ScenarioListBody({ state }: { state: ScenarioListState }): JSX.Element {
  if (state.status === 'loading') {
    return <p>Loading scenarios…</p>
  }

  if (state.status === 'error') {
    return <p className="admin-error">{state.message}</p>
  }

  if (state.scenarios.length === 0) {
    return <p className="admin-muted">No scenarios yet.</p>
  }

  return <ScenarioTable scenarios={state.scenarios} />
}

function ScenarioTable({ scenarios }: { scenarios: ScenarioSummary[] }): JSX.Element {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Objectives</th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((scenario) => {
          const detailRoute: Route = {
            name: 'scenario-detail',
            scenarioId: scenario.scenarioId,
            mode: { kind: 'view' },
          }
          return (
            <tr
              key={scenario.scenarioId}
              onClick={() => {
                navigate(detailRoute)
              }}
            >
              <td>
                <Link to={detailRoute} className="admin-table-link">
                  {scenario.name}
                </Link>
              </td>
              <td>
                <span className="admin-status-pill">{scenario.status}</span>
              </td>
              <td>{scenario.objectives.length}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
