import type { JSX } from 'react'
import { apiUrl } from './env'
import { ScenarioListPage } from './pages/ScenarioListPage'
import { ScenarioPage } from './pages/ScenarioPage'
import { SessionPage } from './pages/SessionPage'
import { Link } from './routing/Link'
import { useRoute } from './routing/router'

function App(): JSX.Element {
  const route = useRoute()

  return (
    <>
      <header className="app-header">
        <Link to={{ name: 'scenarios' }} className="brand">
          Gami debug console
        </Link>
        <span className="muted small mono">{apiUrl}</span>
      </header>
      {route.name === 'scenarios' ? <ScenarioListPage /> : null}
      {route.name === 'scenario' ? <ScenarioPage route={route} /> : null}
      {route.name === 'session' ? <SessionPage route={route} /> : null}
      {route.name === 'not-found' ? (
        <main className="page">
          <p>
            Page not found. <Link to={{ name: 'scenarios' }}>Back to scenarios</Link>
          </p>
        </main>
      ) : null}
    </>
  )
}

export default App
