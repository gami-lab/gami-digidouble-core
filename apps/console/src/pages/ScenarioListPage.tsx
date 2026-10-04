import type { JSX } from 'react'
import { listScenarios } from '../api/scenarios'
import { formatDateTime } from '../debug/format'
import { navigate } from '../routing/router'
import { Badge, Empty, ErrorText } from '../ui/ui'
import { useAsync } from '../ui/use-async'

export function ScenarioListPage(): JSX.Element {
  const scenarios = useAsync(listScenarios, [])

  return (
    <main className="page">
      <h1>Scenarios</h1>
      <p className="muted">
        Pick a scenario to inspect its sessions, avatar preparation, and knowledge retrieval.
        Authoring happens in the admin app.
      </p>
      <ErrorText error={scenarios.error} />
      {scenarios.isLoading && scenarios.data === null ? <Empty>Loading…</Empty> : null}
      {scenarios.data?.length === 0 ? <Empty>No scenarios yet.</Empty> : null}
      {scenarios.data !== null && scenarios.data.length > 0 ? (
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Language</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.data.map((scenario) => (
                <tr
                  key={scenario.scenarioId}
                  className="clickable"
                  onClick={() => {
                    navigate({ name: 'scenario', scenarioId: scenario.scenarioId, tab: 'sessions' })
                  }}
                >
                  <td>
                    <strong>{scenario.name}</strong>
                  </td>
                  <td>
                    <Badge tone={scenario.status === 'active' ? 'ok' : 'neutral'}>
                      {scenario.status}
                    </Badge>
                  </td>
                  <td>{scenario.language ?? '—'}</td>
                  <td className="muted">{formatDateTime(scenario.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  )
}
