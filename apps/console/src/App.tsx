import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { apiUrl } from './env'
import { AvatarPage } from './pages/AvatarPage'
import { ScenarioPage } from './pages/ScenarioPage'

type Page = 'scenario' | 'avatar' | 'session'

type TestContext = {
  scenarioId: string | null
  avatarId: string | null
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
  width: 'min(760px, 92vw)',
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

const sessionPlaceholderStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#ffffff',
}

const breadcrumbItems: Array<{ id: Page; label: string }> = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'avatar', label: 'Avatar' },
  { id: 'session', label: 'Session' },
]

function App(): JSX.Element {
  const [page, setPage] = useState<Page>('scenario')
  const [testContext, setTestContext] = useState<TestContext>({
    scenarioId: null,
    avatarId: null,
    sessionId: null,
  })

  useEffect(() => {
    if (page === 'avatar' && testContext.scenarioId === null) {
      setPage('scenario')
      return
    }

    if (page !== 'session') {
      return
    }

    if (testContext.scenarioId === null) {
      setPage('scenario')
      return
    }

    if (testContext.avatarId === null) {
      setPage('avatar')
    }
  }, [page, testContext.avatarId, testContext.scenarioId])

  const currentBody = useMemo((): JSX.Element => {
    if (page === 'scenario') {
      return (
        <ScenarioPage
          onScenarioCreated={(scenarioId) => {
            setTestContext((previous) => ({
              ...previous,
              scenarioId,
              avatarId: null,
              sessionId: null,
            }))
          }}
          onNext={() => {
            setPage('avatar')
          }}
        />
      )
    }

    if (page === 'avatar') {
      if (testContext.scenarioId === null) {
        return <p>Redirecting to scenario setup…</p>
      }

      return (
        <AvatarPage
          scenarioId={testContext.scenarioId}
          onAvatarCreated={(avatarId) => {
            setTestContext((previous) => ({ ...previous, avatarId, sessionId: null }))
          }}
          onNext={() => {
            setPage('session')
          }}
        />
      )
    }

    return (
      <section style={sessionPlaceholderStyle}>
        <h2 style={{ marginTop: 0 }}>Session & Chat</h2>
        <p style={{ marginBottom: '8px', color: '#4b5563' }}>Prompt 04 will implement this page.</p>
        <p style={{ margin: 0 }}>
          Active context: scenarioId=<strong>{testContext.scenarioId ?? '—'}</strong>, avatarId=
          <strong>{testContext.avatarId ?? '—'}</strong>, sessionId=
          <strong>{testContext.sessionId ?? '—'}</strong>
        </p>
      </section>
    )
  }, [page, testContext.avatarId, testContext.scenarioId, testContext.sessionId])

  return (
    <main style={appContainerStyle}>
      <section style={panelStyle}>
        <h1 style={{ marginTop: 0 }}>Gami DigiDouble — Manual Test Console</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>API URL: {apiUrl}</p>

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
