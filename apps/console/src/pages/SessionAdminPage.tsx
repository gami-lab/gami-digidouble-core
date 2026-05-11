import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { getHistory, listSessionConversations, listSessions, resetSession } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { RuntimeInspector } from '../components/RuntimeInspector'
import { buttonStyle, errorStyle, labelStyle, sectionStyle } from './form-styles'
import type { ConversationSummary, Message } from '../api'
import { KnowledgeOperationsPanel } from './session-admin-knowledge'

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

function SessionResetAction({ session, onReset }: SessionRowProps): JSX.Element {
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleReset = (): void => {
    void performResetSession(session.sessionId, onReset, setIsResetting, setResetError)
  }

  return (
    <>
      <button
        type="button"
        style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }}
        disabled={isResetting}
        onClick={handleReset}
      >
        {isResetting ? 'Resetting…' : 'Reset'}
      </button>
      {resetError !== null ? <span style={{ ...errorStyle, display: 'block' }}>{resetError}</span> : null}
    </>
  )
}

type SessionAdminPageProps = {
  scenarioId?: string | null
}

// eslint-disable-next-line max-lines-per-function, complexity
export function SessionAdminPage({ scenarioId }: SessionAdminPageProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    void loadSessions(scenarioId ?? undefined, setSessions, setIsLoading, setListError)
  }, [scenarioId])

  useEffect(() => {
    if (selectedSessionId === null) {
      setConversations([])
      setSelectedConversationId(null)
      setMessages([])
      setDetailError(null)
      return
    }

    setIsLoadingConversations(true)
    setDetailError(null)
    void (async () => {
      try {
        const nextConversations = await listSessionConversations(selectedSessionId)
        setConversations(nextConversations)
        const firstConversationId = nextConversations[0]?.conversationId ?? null
        setSelectedConversationId(firstConversationId)
      } catch (error) {
        setConversations([])
        setSelectedConversationId(null)
        setMessages([])
        setDetailError(formatApiError(error, 'Failed to load session conversations'))
      } finally {
        setIsLoadingConversations(false)
      }
    })()
  }, [refreshTrigger, selectedSessionId])

  useEffect(() => {
    if (selectedConversationId === null) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    setDetailError(null)
    void (async () => {
      try {
        const history = await getHistory(selectedConversationId)
        setMessages(history.messages)
      } catch (error) {
        setMessages([])
        setDetailError(formatApiError(error, 'Failed to load conversation history'))
      } finally {
        setIsLoadingMessages(false)
      }
    })()
  }, [selectedConversationId])

  const filtered =
    statusFilter === 'all' ? sessions : sessions.filter((s) => s.status === statusFilter)

  const handleSessionReset = (updated: SessionSummary): void => {
    setSessions((prev) => prev.map((s) => (s.sessionId === updated.sessionId ? updated : s)))
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Session Admin</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        View sessions and inspect one canonical runtime detail flow
        {scenarioId !== undefined && scenarioId !== null ? ` for scenario ${scenarioId}` : ''}.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
        <label
          style={{ ...labelStyle, marginTop: 0, marginBottom: 0 }}
          htmlFor="session-status-filter"
        >
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
              <th style={thStyle}>Inspect</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((session) => {
              const isSelected = session.sessionId === selectedSessionId
              return (
                <tr key={session.sessionId} style={isSelected ? { backgroundColor: '#f9fafb' } : {}}>
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
                      onClick={() => {
                        setSelectedSessionId(session.sessionId)
                        setRefreshTrigger((previous) => previous + 1)
                      }}
                    >
                      {isSelected ? 'Selected' : 'Inspect'}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <SessionResetAction session={session} onReset={handleSessionReset} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Session Detail</h3>
        {selectedSessionId === null ? (
          <p style={{ color: '#6b7280' }}>Select a session to inspect detail.</p>
        ) : (
          <>
            <RuntimeInspector
              sessionId={selectedSessionId}
              refreshTrigger={refreshTrigger}
              title="Session Inspector"
            />
            <KnowledgeOperationsPanel
              scenarioId={
                sessions.find((session) => session.sessionId === selectedSessionId)?.scenarioId ?? null
              }
              sessionId={selectedSessionId}
              conversationId={selectedConversationId}
            />
            <div style={{ marginTop: '12px' }}>
              <strong>Messages</strong>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label htmlFor="conversation-select" style={{ ...labelStyle, margin: 0 }}>
                  Conversation
                </label>
                <select
                  id="conversation-select"
                  value={selectedConversationId ?? ''}
                  onChange={(event) => {
                    setSelectedConversationId(event.target.value || null)
                  }}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                >
                  {conversations.map((conversation) => (
                    <option key={conversation.conversationId} value={conversation.conversationId}>
                      {conversation.conversationId.slice(0, 8)}… ({conversation.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => {
                    setRefreshTrigger((previous) => previous + 1)
                  }}
                >
                  Refresh detail
                </button>
              </div>
              {isLoadingConversations ? <p>Loading conversations…</p> : null}
              {isLoadingMessages ? <p>Loading messages…</p> : null}
              {detailError !== null ? <p style={errorStyle}>{detailError}</p> : null}
              {!isLoadingMessages && messages.length === 0 && selectedConversationId !== null ? (
                <p style={{ color: '#6b7280' }}>No messages in this conversation.</p>
              ) : null}
              {messages.length > 0 ? (
                <div
                  style={{
                    marginTop: '8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: '#ffffff',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {messages.map((message) => (
                    <p key={message.messageId} style={{ margin: '0 0 8px 0', color: '#374151' }}>
                      <strong>{message.role}</strong>: {message.content}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export async function loadSessions(
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


export async function performResetSession(
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
