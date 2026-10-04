import type { JSX } from 'react'
import { shortId } from '../debug/format'
import { Link } from '../routing/Link'
import type { Route, SessionView } from '../routing/router'
import { Empty, ErrorText } from '../ui/ui'
import { ContextView } from './session/ContextView'
import { MemoryView } from './session/MemoryView'
import { SessionHeader } from './session/SessionHeader'
import { TurnsView } from './session/TurnsView'
import { useSessionData } from './session/use-session-data'

type SessionRoute = Extract<Route, { name: 'session' }>

const viewLabels: Record<SessionView, string> = {
  turns: 'Turns',
  memory: 'Memory now',
  context: 'Next-turn context',
}

export function SessionPage({ route }: { route: SessionRoute }): JSX.Element {
  const session = useSessionData(route.sessionId)
  const data = session.data

  return (
    <main className="page">
      <nav className="crumbs">
        <Link to={{ name: 'scenarios' }}>Scenarios</Link>
        <span>/</span>
        {data !== null ? (
          <Link to={{ name: 'scenario', scenarioId: data.scenario.scenarioId, tab: 'sessions' }}>
            {data.scenario.name}
          </Link>
        ) : (
          <span>…</span>
        )}
        <span>/</span>
        <span className="mono">session {shortId(route.sessionId)}</span>
      </nav>
      <ErrorText error={session.error} />
      {data === null ? (
        session.error === null ? (
          <Empty>Loading session…</Empty>
        ) : null
      ) : (
        <>
          <SessionHeader data={data} state={session} />
          <nav className="tabs">
            {(Object.keys(viewLabels) as SessionView[]).map((view) => (
              <Link
                key={view}
                to={{ ...route, view, turn: view === 'turns' ? route.turn : null }}
                current={view === route.view}
              >
                {viewLabels[view]}
              </Link>
            ))}
          </nav>
          {route.view === 'turns' ? (
            <TurnsView route={route} data={data} onChanged={session.reload} />
          ) : null}
          {route.view === 'memory' ? <MemoryView sessionId={route.sessionId} data={data} /> : null}
          {route.view === 'context' ? (
            <ContextView sessionId={route.sessionId} data={data} />
          ) : null}
        </>
      )}
    </main>
  )
}
