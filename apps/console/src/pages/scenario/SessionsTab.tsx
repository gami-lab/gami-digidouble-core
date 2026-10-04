import { useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../../api/error'
import { listScenarioAvatars } from '../../api/scenarios'
import { listSessions, startSession } from '../../api/sessions'
import { formatDateTime, shortId } from '../../debug/format'
import { navigate } from '../../routing/router'
import { Badge, Empty, ErrorText } from '../../ui/ui'
import { useAsync } from '../../ui/use-async'

export function SessionsTab({ scenarioId }: { scenarioId: string }): JSX.Element {
  const sessions = useAsync(() => listSessions(scenarioId), [scenarioId])
  const avatars = useAsync(() => listScenarioAvatars(scenarioId), [scenarioId])
  const avatarNames = new Map((avatars.data ?? []).map((avatar) => [avatar.avatarId, avatar.name]))
  const sorted = [...(sessions.data ?? [])].sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  )

  return (
    <div className="stack">
      <div className="row spread">
        <p className="muted">
          Sessions started from the web app or here. Open one to follow its turns, GM decisions, and
          memory.
        </p>
        <div className="row">
          <button type="button" onClick={sessions.reload}>
            Refresh
          </button>
          <StartSessionForm scenarioId={scenarioId} />
        </div>
      </div>
      <ErrorText error={sessions.error} />
      {sessions.data !== null && sorted.length === 0 ? <Empty>No sessions yet.</Empty> : null}
      {sorted.length > 0 ? (
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Session</th>
                <th>User</th>
                <th>Status</th>
                <th>Active avatar</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((session) => (
                <tr
                  key={session.sessionId}
                  className="clickable"
                  onClick={() => {
                    navigate({
                      name: 'session',
                      sessionId: session.sessionId,
                      view: 'turns',
                      turn: null,
                    })
                  }}
                >
                  <td className="mono" title={session.sessionId}>
                    {shortId(session.sessionId)}
                  </td>
                  <td>{session.userId}</td>
                  <td>
                    <Badge tone={session.status === 'active' ? 'ok' : 'neutral'}>
                      {session.status}
                    </Badge>
                  </td>
                  <td>
                    {session.activeAvatarId !== undefined
                      ? (avatarNames.get(session.activeAvatarId) ?? shortId(session.activeAvatarId))
                      : '—'}
                  </td>
                  <td className="muted">{formatDateTime(session.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function StartSessionForm({ scenarioId }: { scenarioId: string }): JSX.Element {
  const [userId, setUserId] = useState('console-debugger')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  async function start(): Promise<void> {
    setIsStarting(true)
    setError(null)
    try {
      const session = await startSession(userId.trim(), scenarioId)
      navigate({ name: 'session', sessionId: session.sessionId, view: 'turns', turn: null })
    } catch (startError) {
      setError(formatApiError(startError, 'Could not start session'))
      setIsStarting(false)
    }
  }

  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault()
        void start()
      }}
    >
      <input
        aria-label="User id"
        value={userId}
        onChange={(event) => {
          setUserId(event.target.value)
        }}
        style={{ width: 150 }}
      />
      <button type="submit" className="primary" disabled={isStarting || userId.trim() === ''}>
        New debug session
      </button>
      <ErrorText error={error} />
    </form>
  )
}
