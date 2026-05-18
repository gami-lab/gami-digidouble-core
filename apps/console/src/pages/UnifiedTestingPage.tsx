import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { ConversationSummary, ScenarioSummary } from '../api'
import { listSessionConversations } from '../api'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { listSessions, resetSession } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { RuntimeInspector } from '../components/RuntimeInspector'
import { DebugShellPage } from './DebugShellPage'
import { buttonStyle, errorStyle, labelStyle, sectionStyle } from './form-styles'
import { KnowledgeOperationsPanel } from './session-admin-knowledge'

type StatusFilter = 'all' | 'active' | 'closed' | 'archived'
type UnifiedTab = 'run' | 'knowledge' | 'inspector'

type UnifiedTestingPageProps = {
  scenario: ScenarioSummary
}

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

const tabs: Array<{ id: UnifiedTab; label: string }> = [
  { id: 'run', label: 'Run and Debug' },
  { id: 'knowledge', label: 'Knowledge Ops' },
  { id: 'inspector', label: 'Runtime Inspector' },
]

// eslint-disable-next-line max-lines-per-function, complexity
export function UnifiedTestingPage({ scenario }: UnifiedTestingPageProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState<UnifiedTab>('run')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [conversationsError, setConversationsError] = useState<string | null>(null)

  useEffect(() => {
    void loadScenarioSessions(
      scenario.scenarioId,
      setSessions,
      setIsLoadingSessions,
      setSessionsError,
      selectedSessionId,
      setSelectedSessionId,
    )
  }, [refreshTrigger, scenario.scenarioId, selectedSessionId])

  useEffect(() => {
    if (selectedSessionId === null) {
      setConversations([])
      setSelectedConversationId(null)
      setConversationsError(null)
      return
    }
    setIsLoadingConversations(true)
    setConversationsError(null)
    void (async () => {
      try {
        const nextConversations = await listSessionConversations(selectedSessionId)
        setConversations(nextConversations)
        setSelectedConversationId((previous) => {
          if (previous !== null && nextConversations.some((item) => item.conversationId === previous)) {
            return previous
          }
          return nextConversations[0]?.conversationId ?? null
        })
      } catch (error) {
        setConversations([])
        setSelectedConversationId(null)
        setConversationsError(formatApiError(error, 'Failed to load session conversations'))
      } finally {
        setIsLoadingConversations(false)
      }
    })()
  }, [selectedSessionId])

  const filteredSessions =
    statusFilter === 'all' ? sessions : sessions.filter((session) => session.status === statusFilter)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  )

  const handleShellSessionChanged = (sessionId: string | null): void => {
    if (sessionId === null) return
    setSelectedSessionId(sessionId)
    setRefreshTrigger((previous) => previous + 1)
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Unified Session Runner</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Single path for session testing and debugging in scenario <strong>{scenario.name}</strong>.
      </p>

      <SessionListToolbar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onRefresh={() => {
          setRefreshTrigger((previous) => previous + 1)
        }}
      />

      {isLoadingSessions ? <p>Loading sessions…</p> : null}
      {sessionsError !== null ? <p style={errorStyle}>{sessionsError}</p> : null}
      {!isLoadingSessions && filteredSessions.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No sessions found for this scenario.</p>
      ) : null}

      {filteredSessions.length > 0 ? (
        <SessionTable
          sessions={filteredSessions}
          selectedSessionId={selectedSessionId}
          onSelect={(sessionId) => {
            setSelectedSessionId(sessionId)
          }}
          onReset={(updatedSession) => {
            setSessions((previous) =>
              previous.map((session) =>
                session.sessionId === updatedSession.sessionId ? updatedSession : session,
              ),
            )
            setRefreshTrigger((previous) => previous + 1)
          }}
        />
      ) : null}

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '8px 10px',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === tab.id ? '#ffffff' : '#111827',
              backgroundColor: activeTab === tab.id ? '#111827' : '#ffffff',
            }}
            onClick={() => {
              setActiveTab(tab.id)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '12px' }}>
        {activeTab === 'run' ? (
          <DebugShellPage scenario={scenario} onSessionChanged={handleShellSessionChanged} />
        ) : null}

        {activeTab === 'knowledge' ? (
          selectedSessionId === null ? (
            <p style={{ color: '#6b7280' }}>
              Select a session from the list above to manage knowledge operations.
            </p>
          ) : (
            <>
              <SessionConversationSelector
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                onSelectedConversationChanged={setSelectedConversationId}
                isLoadingConversations={isLoadingConversations}
                conversationsError={conversationsError}
              />
              <KnowledgeOperationsPanel
                scenarioId={selectedSession?.scenarioId ?? null}
                sessionId={selectedSessionId}
                conversationId={selectedConversationId}
              />
            </>
          )
        ) : null}

        {activeTab === 'inspector' ? (
          selectedSessionId === null ? (
            <p style={{ color: '#6b7280' }}>
              Select a session from the list above to inspect runtime traces.
            </p>
          ) : (
            <RuntimeInspector
              sessionId={selectedSessionId}
              refreshTrigger={refreshTrigger + conversations.length}
              title="Session Inspector"
            />
          )
        ) : null}
      </div>
    </section>
  )
}

type SessionListToolbarProps = {
  statusFilter: StatusFilter
  setStatusFilter: (next: StatusFilter) => void
  onRefresh: () => void
}

function SessionListToolbar({
  statusFilter,
  setStatusFilter,
  onRefresh,
}: SessionListToolbarProps): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
      <label
        style={{ ...labelStyle, marginTop: 0, marginBottom: 0 }}
        htmlFor="unified-session-status-filter"
      >
        Filter by status:
      </label>
      <select
        id="unified-session-status-filter"
        value={statusFilter}
        onChange={(event) => {
          setStatusFilter(event.target.value as StatusFilter)
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
        onClick={onRefresh}
      >
        Refresh
      </button>
    </div>
  )
}

type SessionTableProps = {
  sessions: SessionSummary[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  onReset: (updatedSession: SessionSummary) => void
}

function SessionTable({ sessions, selectedSessionId, onSelect, onReset }: SessionTableProps): JSX.Element {
  return (
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
        {sessions.map((session) => {
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }}
                    onClick={() => {
                      onSelect(session.sessionId)
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                  <SessionResetAction session={session} onReset={onReset} />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

type SessionConversationSelectorProps = {
  conversations: ConversationSummary[]
  selectedConversationId: string | null
  onSelectedConversationChanged: (conversationId: string | null) => void
  isLoadingConversations: boolean
  conversationsError: string | null
}

function SessionConversationSelector({
  conversations,
  selectedConversationId,
  onSelectedConversationChanged,
  isLoadingConversations,
  conversationsError,
}: SessionConversationSelectorProps): JSX.Element {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label htmlFor="unified-conversation-select" style={{ ...labelStyle, margin: 0 }}>
          Conversation
        </label>
        <select
          id="unified-conversation-select"
          value={selectedConversationId ?? ''}
          onChange={(event) => {
            onSelectedConversationChanged(event.target.value || null)
          }}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          {conversations.map((conversation) => (
            <option key={conversation.conversationId} value={conversation.conversationId}>
              {conversation.conversationId.slice(0, 8)}… ({conversation.status})
            </option>
          ))}
        </select>
      </div>
      {isLoadingConversations ? <p>Loading conversations…</p> : null}
      {conversationsError !== null ? <p style={errorStyle}>{conversationsError}</p> : null}
      {!isLoadingConversations && conversations.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No conversations found for this session.</p>
      ) : null}
    </div>
  )
}

type SessionResetActionProps = {
  session: SessionSummary
  onReset: (updated: SessionSummary) => void
}

function SessionResetAction({ session, onReset }: SessionResetActionProps): JSX.Element {
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

export async function loadScenarioSessions(
  scenarioId: string,
  setSessions: (sessions: SessionSummary[]) => void,
  setIsLoading: (isLoading: boolean) => void,
  setError: (error: string | null) => void,
  selectedSessionId: string | null,
  setSelectedSessionId: (sessionId: string | null) => void,
): Promise<void> {
  setError(null)
  setIsLoading(true)
  try {
    const listedSessions = await listSessions({ scenarioId })
    setSessions(listedSessions)
    if (listedSessions.length === 0) {
      setSelectedSessionId(null)
      return
    }
    if (selectedSessionId !== null && listedSessions.some((session) => session.sessionId === selectedSessionId)) {
      return
    }
    const firstSession = listedSessions[0]
    if (firstSession === undefined) {
      setSelectedSessionId(null)
      return
    }
    setSelectedSessionId(firstSession.sessionId)
  } catch (error) {
    setError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load sessions'))
  } finally {
    setIsLoading(false)
  }
}

export async function performResetSession(
  sessionId: string,
  onReset: (updated: SessionSummary) => void,
  setIsResetting: (isResetting: boolean) => void,
  setResetError: (error: string | null) => void,
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
