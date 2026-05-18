import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { apiUrl } from './env'
import type { ScenarioSummary } from './api'
import { ScenarioPage } from './pages/ScenarioPage'
import { UnifiedTestingPage } from './pages/UnifiedTestingPage'

type Page = 'scenario' | 'unified-testing'

const pageOrder: Page[] = ['scenario', 'unified-testing']

type TestContext = {
  scenario: ScenarioSummary | null
}

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

const breadcrumbItems: Array<{ id: Page; label: string }> = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'unified-testing', label: 'Unified Session Runner' },
]

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
  const [page, setPage] = useState<Page>('scenario')
  const [testContext, setTestContext] = useState<TestContext>({
    scenario: null,
  })

  useEffect(() => {
    if (page !== 'scenario' && testContext.scenario === null) {
      setPage('scenario')
    }
  }, [page, testContext.scenario])

  const currentBody = useMemo((): JSX.Element => {
    if (page === 'scenario') {
      return (
        <ScenarioPageWithActions
          selectedScenarioId={testContext.scenario?.scenarioId ?? null}
          onScenarioSelected={(scenario) => {
            setTestContext({ scenario })
          }}
          onOpenUnifiedTesting={() => {
            setPage('unified-testing')
          }}
        />
      )
    }
    if (testContext.scenario === null) return <p>Redirecting to setup…</p>
    return <UnifiedTestingPage scenario={testContext.scenario} />
  }, [page, testContext.scenario])

  function handleBreadcrumbClick(targetPage: Page): void {
    const targetIndex = pageOrder.indexOf(targetPage)
    const currentIndex = pageOrder.indexOf(page)
    if (targetIndex < currentIndex) {
      setPage(targetPage)
    }
  }

  return (
    <main style={appContainerStyle}>
      <section style={panelStyle}>
        <h1 style={{ marginTop: 0 }}>Gami DigiDouble — Manual Test Console</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>API URL: {apiUrl}</p>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Session = global run. Conversation = one avatar thread inside that session.
        </p>
        <Breadcrumb activePage={page} onNavigate={handleBreadcrumbClick} />
        {currentBody}
      </section>
    </main>
  )
}

type BreadcrumbProps = { activePage: Page; onNavigate: (page: Page) => void }

function Breadcrumb({ activePage, onNavigate }: BreadcrumbProps): JSX.Element {
  const currentIndex = pageOrder.indexOf(activePage)
  return (
    <nav style={breadcrumbStyle} aria-label="Page flow">
      {breadcrumbItems.map((item, index) => {
        const itemIndex = pageOrder.indexOf(item.id)
        const isActive = item.id === activePage
        const isClickable = itemIndex < currentIndex
        return (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {isClickable ? (
              <button
                type="button"
                onClick={() => {
                  onNavigate(item.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#3b82f6',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                {item.label}
              </button>
            ) : (
              <span style={isActive ? breadcrumbActiveStyle : breadcrumbInactiveStyle}>
                {item.label}
              </span>
            )}
            {index < breadcrumbItems.length - 1 ? (
              <span style={{ color: '#9ca3af', fontWeight: 600 }}>→</span>
            ) : null}
          </span>
        )
      })}
    </nav>
  )
}

export default App
