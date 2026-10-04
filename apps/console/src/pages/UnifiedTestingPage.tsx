import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { ConversationSummary, ScenarioSummary } from '../api'
import { listSessionConversations } from '../api'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { listSessions, resetSession } from '../api/sessions'
import type { SessionSummary } from '../api/sessions'
import { RuntimeInspector } from '../components/RuntimeInspector'
import { DebugShellPage } from './DebugShellPage'
import { ModelConfigPanel } from './ModelConfigPanel'
import { buttonStyle, errorStyle, labelStyle, sectionStyle } from './form-styles'
import { KnowledgeOperationsPanel } from './session-admin-knowledge'
import { Link } from '../routing/Link'
import { parseRoute, updateRunnerRoute, type Route, type RunnerTab } from '../routing/router'

type StatusFilter = 'all' | 'active' | 'closed' | 'archived'

type UnifiedTestingPageProps = {
  scenario: ScenarioSummary
  route: Extract<Route, { name: 'runner' }>
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

const tabs: Array<{ id: RunnerTab; label: string }> = [
  { id: 'run', label: 'Run and Debug' },
  { id: 'knowledge', label: 'Knowledge Ops' },
  { id: 'inspector', label: 'Runtime Inspector' },
  { id: 'model-config', label: 'Model Configuration' },
]

// eslint-disable-next-line max-lines-per-function, complexity
export function UnifiedTestingPage({ scenario, route }: UnifiedTestingPageProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const { tab: activeTab, sessionId: selectedSessionId, conversationId: selectedConversationId } =
    route
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [conversationsError, setConversationsError] = useState<string | null>(null)

  useEffect(() => {
    void loadScenarioSessions(
      scenario.scenarioId,
      setSessions,
      setIsLoadingSessions,
      setSessionsError,
      selectedSessionId,
      selectAutomaticSession,
    )
  }, [refreshTrigger, scenario.scenarioId])

  useEffect(() => {
    if (selectedSessionId === null) {
      setConversations([])
      setConversationsError(null)
      return
    }
    setIsLoadingConversations(true)
    setConversationsError(null)
    void (async () => {
      try {
        const nextConversations = await listSessionConversations(selectedSessionId)
        setConversations(nextConversations)
        selectAutomaticConversation(nextConversations)
      } catch (error) {
        setConversations([])
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

  const handleShellSessionChanged = useCallback((sessionId: string | null): void => {
    if (sessionId === null || sessionId === selectedSessionId) return
    updateRunnerRoute({ sessionId })
    setRefreshTrigger((previous) => previous + 1)
  }, [selectedSessionId])

  // The shell reports null while it resets; keep the URL's conversation until it settles on one.
  const handleShellConversationChanged = useCallback((conversationId: string | null): void => {
    if (conversationId !== null) updateRunnerRoute({ conversationId }, { replace: true })
  }, [])

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
            updateRunnerRoute({ sessionId })
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
          <Link
            key={tab.id}
            to={{ ...route, tab: tab.id }}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '8px 10px',
              fontWeight: 600,
              textDecoration: 'none',
              color: activeTab === tab.id ? '#ffffff' : '#111827',
              backgroundColor: activeTab === tab.id ? '#111827' : '#ffffff',
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '12px' }}>
        {activeTab === 'run' ? (
          <DebugShellPage
            scenario={scenario}
            selectedSessionId={selectedSessionId}
            selectedConversationId={selectedConversationId}
            onSessionChanged={handleShellSessionChanged}
            onConversationChanged={handleShellConversationChanged}
          />
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
                onSelectedConversationChanged={(conversationId) => {
                  updateRunnerRoute({ conversationId })
                }}
                isLoadingConversations={isLoadingConversations}
                conversationsError={conversationsError}
              />
              <KnowledgeOperationsPanel
                scenarioId={selectedSession?.scenarioId ?? null}
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
        {activeTab === 'model-config' ? <ModelConfigPanel /> : null}
      </div>
    </section>
  )
}

// Fills an empty or stale session/conversation in the URL without adding a history entry.
function selectAutomaticSession(sessionId: string | null): void {
  updateRunnerRoute({ sessionId }, { replace: true })
}

function selectAutomaticConversation(conversations: ConversationSummary[]): void {
  const current = parseRoute(window.location.pathname, window.location.search)
  if (current.name !== 'runner') return
  const isKnown = conversations.some((item) => item.conversationId === current.conversationId)
  if (isKnown) return
  updateRunnerRoute(
    { conversationId: conversations[0]?.conversationId ?? null },
    { replace: true },
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
