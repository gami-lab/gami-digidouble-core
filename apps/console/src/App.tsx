import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { apiUrl } from './env'
import type { AvatarSummary, ScenarioSummary } from './api'
import { AvatarPage } from './pages/AvatarPage'
import { ScenarioPage } from './pages/ScenarioPage'
import { SessionPage } from './pages/SessionPage'

type Page = 'scenario' | 'avatar' | 'session'

type TestContext = {
  scenario: ScenarioSummary | null
  avatar: AvatarSummary | null
  sessionId: string | null
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
  { id: 'avatar', label: 'Avatar' },
  { id: 'session', label: 'Session + Conversations' },
]

function App(): JSX.Element {
  const [page, setPage] = useState<Page>('scenario')
  const [testContext, setTestContext] = useState<TestContext>({
    scenario: null,
    avatar: null,
    sessionId: null,
  })

  useEffect(() => {
    if (page === 'avatar' && testContext.scenario === null) {
      setPage('scenario')
      return
    }

    if (page === 'session' && testContext.scenario === null) {
      setPage('scenario')
    }
  }, [page, testContext.scenario])

  const currentBody = useMemo((): JSX.Element => {
    if (page === 'scenario') {
      return (
        <ScenarioPage
          selectedScenarioId={testContext.scenario?.scenarioId ?? null}
          onScenarioSelected={(scenario) => {
            setTestContext({ scenario, avatar: null, sessionId: null })
          }}
          onNext={() => {
            setPage('avatar')
          }}
        />
      )
    }

    if (page === 'avatar') {
      if (testContext.scenario === null) {
        return <p>Redirecting to scenario setup…</p>
      }

      return (
        <AvatarPage
          scenarioId={testContext.scenario.scenarioId}
          selectedAvatarId={testContext.avatar?.avatarId ?? null}
          onAvatarSelected={(avatar) => {
            setTestContext((previous) => ({ ...previous, avatar, sessionId: null }))
          }}
          onNext={() => {
            setPage('session')
          }}
        />
      )
    }

    if (testContext.scenario === null) {
      return <p>Redirecting to setup…</p>
    }

    return (
      <SessionPage
        scenario={testContext.scenario}
        initialAvatar={testContext.avatar}
        sessionId={testContext.sessionId}
        onSessionIdChange={(sessionId) => {
          setTestContext((previous) => ({ ...previous, sessionId }))
        }}
      />
    )
  }, [page, testContext.avatar, testContext.scenario, testContext.sessionId])

  return (
    <main style={appContainerStyle}>
      <section style={panelStyle}>
        <h1 style={{ marginTop: 0 }}>Gami DigiDouble — Manual Test Console</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>API URL: {apiUrl}</p>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Session = global run. Conversation = one avatar thread inside that session.
        </p>

        <nav style={breadcrumbStyle} aria-label="Page flow">
          {breadcrumbItems.map((item, index) => (
            <span
              key={item.id}
              style={item.id === page ? breadcrumbActiveStyle : breadcrumbInactiveStyle}
            >
              {item.label}
              {index < breadcrumbItems.length - 1 ? ' →' : ''}
            </span>
          ))}
        </nav>

        {currentBody}
      </section>
    </main>
  )
}

export default App
