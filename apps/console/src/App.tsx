import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { apiUrl } from './env'
import { listScenarios, type ScenarioSummary } from './api'
import { formatApiError } from './api/error'
import { ScenarioPage } from './pages/ScenarioPage'
import { UnifiedTestingPage } from './pages/UnifiedTestingPage'
import { Link } from './routing/Link'
import { navigate, useRoute, type Route } from './routing/router'

const appContainerStyle: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f7f8fa',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  color: '#1f2937',
  padding: '24px 0',
}

const panelStyle: CSSProperties = {
  width: 'min(980px, 95vw)',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.06)',
}

const breadcrumbStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '20px',
  fontWeight: 600,
}

const breadcrumbActiveStyle: CSSProperties = {
  color: '#111827',
}

const breadcrumbInactiveStyle: CSSProperties = {
  color: '#9ca3af',
}

const breadcrumbLinkStyle: CSSProperties = {
  fontWeight: 600,
  color: '#3b82f6',
  textDecoration: 'underline',
}

type ScenarioPageWithActionsProps = {
  selectedScenarioId: string | null
  onScenarioSelected: (s: ScenarioSummary) => void
  onOpenUnifiedTesting: () => void
}

function ScenarioPageWithActions({
  selectedScenarioId,
  onScenarioSelected,
  onOpenUnifiedTesting,
}: ScenarioPageWithActionsProps): JSX.Element {
  return (
    <>
      <ScenarioPage
        selectedScenarioId={selectedScenarioId}
        onScenarioSelected={onScenarioSelected}
        onNext={onOpenUnifiedTesting}
      />
      {selectedScenarioId !== null ? (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onOpenUnifiedTesting}
            style={{
              border: '1px solid #2563eb',
              borderRadius: '8px',
              padding: '8px 12px',
              fontWeight: 600,
              color: '#1d4ed8',
              backgroundColor: '#eff6ff',
              cursor: 'pointer',
            }}
          >
            Open unified session runner
          </button>
        </div>
      ) : null}
    </>
  )
}

function App(): JSX.Element {
  const route = useRoute()
  const scenarioId = route.name === 'not-found' ? null : route.scenarioId
  const { scenario, error: scenarioError } = useScenario(scenarioId)

  let body: JSX.Element
  if (route.name === 'not-found') {
    body = <p>Page not found.</p>
  } else if (route.name === 'setup') {
    body = (
      <ScenarioPageWithActions
        selectedScenarioId={route.scenarioId}
        onScenarioSelected={(selected) => {
          navigate({ name: 'setup', scenarioId: selected.scenarioId })
        }}
        onOpenUnifiedTesting={() => {
          if (route.scenarioId === null) return
          navigate(runnerRoute(route.scenarioId))
        }}
      />
    )
  } else if (scenarioError !== null) {
    body = <p style={{ color: '#b91c1c' }}>{scenarioError}</p>
  } else if (scenario === null) {
    body = <p>Loading scenario…</p>
  } else {
    body = <UnifiedTestingPage scenario={scenario} route={route} />
  }

  return (
    <main style={appContainerStyle}>
      <section style={panelStyle}>
        <h1 style={{ marginTop: 0 }}>Gami DigiDouble — Manual Test Console</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>API URL: {apiUrl}</p>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Session = global run. Conversation = one avatar thread inside that session.
        </p>
        <Breadcrumb route={route} />
        {body}
      </section>
    </main>
  )
}

function runnerRoute(scenarioId: string): Route {
  return { name: 'runner', scenarioId, tab: 'run', sessionId: null, conversationId: null }
}

// Resolves the scenario named by the URL so runner pages survive a reload.
function useScenario(scenarioId: string | null): {
  scenario: ScenarioSummary | null
  error: string | null
} {
  const [scenario, setScenario] = useState<ScenarioSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    if (scenarioId === null) {
      setScenario(null)
      return
    }
    let isCancelled = false
    void listScenarios()
      .then((scenarios) => {
        if (isCancelled) return
        const found = scenarios.find((item) => item.scenarioId === scenarioId) ?? null
        setScenario(found)
        if (found === null) setError(`Scenario ${scenarioId} not found.`)
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) setError(formatApiError(loadError, 'Failed to load scenario'))
      })
    return () => {
      isCancelled = true
    }
  }, [scenarioId])

  return { scenario: scenario?.scenarioId === scenarioId ? scenario : null, error }
}

function Breadcrumb({ route }: { route: Route }): JSX.Element {
  const scenarioId = route.name === 'not-found' ? null : route.scenarioId
  const items: Array<{ label: string; target: Route | null; isActive: boolean }> = [
    {
      label: 'Scenario',
      target: { name: 'setup', scenarioId },
      isActive: route.name === 'setup',
    },
    {
      label: 'Unified Session Runner',
      target: scenarioId === null ? null : runnerRoute(scenarioId),
      isActive: route.name === 'runner',
    },
  ]

  return (
    <nav style={breadcrumbStyle} aria-label="Page flow">
      {items.map((item, index) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {item.target !== null && !item.isActive ? (
            <Link to={item.target} style={breadcrumbLinkStyle}>
              {item.label}
            </Link>
          ) : (
            <span style={item.isActive ? breadcrumbActiveStyle : breadcrumbInactiveStyle}>
              {item.label}
            </span>
          )}
          {index < items.length - 1 ? (
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>→</span>
          ) : null}
        </span>
      ))}
    </nav>
  )
}

export default App
