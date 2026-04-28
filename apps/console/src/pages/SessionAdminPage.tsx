import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { listSessions, resetSession } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { buttonStyle, errorStyle, labelStyle, sectionStyle } from './form-styles'

type StatusFilter = 'all' | 'active' | 'closed' | 'archived'

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '12px',
  fontSize: '13px',
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid #d1d5db',
  fontWeight: 600,
  color: '#374151',
}

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'middle',
}

type SessionRowProps = {
  session: SessionSummary
  onReset: (updated: SessionSummary) => void
}

function SessionAdminRow({ session, onReset }: SessionRowProps): JSX.Element {
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleReset = (): void => {
    void performResetSession(session.sessionId, onReset, setIsResetting, setResetError)
  }

  return (
    <tr>
      <td style={tdStyle} title={session.sessionId}>
        {session.sessionId.slice(0, 8)}…
      </td>
      <td style={tdStyle}>{session.userId}</td>
      <td style={tdStyle}>{session.status}</td>
      <td style={tdStyle}>{new Date(session.lastActivityAt).toLocaleString()}</td>
      <td style={tdStyle}>
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }}
          disabled={isResetting}
          onClick={handleReset}
        >
          {isResetting ? 'Resetting…' : 'Reset'}
        </button>
        {resetError !== null ? <span style={{ ...errorStyle, display: 'block' }}>{resetError}</span> : null}
      </td>
    </tr>
  )
}

type SessionAdminPageProps = {
  scenarioId?: string | null
}

export function SessionAdminPage({ scenarioId }: SessionAdminPageProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    void loadSessions(scenarioId ?? undefined, setSessions, setIsLoading, setListError)
  }, [scenarioId])

  const filtered =
    statusFilter === 'all' ? sessions : sessions.filter((s) => s.status === statusFilter)

  const handleSessionReset = (updated: SessionSummary): void => {
    setSessions((prev) =>
      prev.map((s) => (s.sessionId === updated.sessionId ? updated : s)),
    )
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Session Admin</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        View and reset all sessions
        {scenarioId !== undefined && scenarioId !== null ? ` for scenario ${scenarioId}` : ''}.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
        <label style={{ ...labelStyle, marginTop: 0, marginBottom: 0 }} htmlFor="session-status-filter">
          Filter by status:
        </label>
        <select
          id="session-status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter)
          }}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          <option value="all">all</option>
          <option value="active">active</option>
          <option value="closed">closed</option>
          <option value="archived">archived</option>
        </select>
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: 0, fontSize: '13px', padding: '6px 10px' }}
          onClick={() => {
            void loadSessions(scenarioId ?? undefined, setSessions, setIsLoading, setListError)
          }}
        >
          Refresh
        </button>
      </div>

      {isLoading ? <p>Loading sessions…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {!isLoading && filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No sessions found.</p>
      ) : null}
      {filtered.length > 0 ? (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Session ID</th>
              <th style={thStyle}>User ID</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last Activity</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((session) => (
              <SessionAdminRow
                key={session.sessionId}
                session={session}
                onReset={handleSessionReset}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}

async function loadSessions(
  scenarioId: string | undefined,
  setSessions: (v: SessionSummary[]) => void,
  setIsLoading: (v: boolean) => void,
  setListError: (v: string | null) => void,
): Promise<void> {
  setListError(null)
  setIsLoading(true)
  try {
    const result = await listSessions(scenarioId !== undefined ? { scenarioId } : undefined)
    setSessions(result)
  } catch (error) {
    setListError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load sessions'))
  } finally {
    setIsLoading(false)
  }
}

async function performResetSession(
  sessionId: string,
  onReset: (updated: SessionSummary) => void,
  setIsResetting: (v: boolean) => void,
  setResetError: (v: string | null) => void,
): Promise<void> {
  if (!window.confirm('Reset session? This will clear all messages and conversations.')) return
  setResetError(null)
  setIsResetting(true)
  try {
    const updated = await resetSession(sessionId)
    onReset(updated)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      setResetError('Session not found.')
    } else {
      setResetError(formatApiError(error, 'UNKNOWN_ERROR: Failed to reset session'))
    }
  } finally {
    setIsResetting(false)
  }
}
