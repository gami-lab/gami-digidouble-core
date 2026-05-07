import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import {
  clearSessionMemory,
  loadRuntimeInspectorViewModel,
  refreshSessionMemory,
  replayGm,
  resetSession,
  subscribeToRuntimeEvents,
  upsertUserPersona,
} from '../api'
import type { RuntimeInspectorViewModel } from '../api'
import type { RuntimeEvent, UserPersona } from '@gami/shared'
import { formatApiError } from '../api/error'

type RuntimeInspectorProps = {
  sessionId: string | null
  refreshTrigger: number
}

type InspectorTab = 'overview' | 'memory' | 'context' | 'events' | 'metrics' | 'persona' | 'actions'

const tabOrder: InspectorTab[] = [
  'overview',
  'memory',
  'context',
  'events',
  'metrics',
  'persona',
  'actions',
]

const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
  fontSize: '13px',
}

const tabButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '12px',
  cursor: 'pointer',
}

const activeTabButtonStyle: CSSProperties = {
  ...tabButtonStyle,
  borderColor: '#111827',
  backgroundColor: '#111827',
  color: '#ffffff',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '6px',
  alignItems: 'flex-start',
}

const keyStyle: CSSProperties = {
  fontWeight: 600,
  color: '#374151',
  flexShrink: 0,
  width: '170px',
}

const valueStyle: CSSProperties = {
  color: '#111827',
  wordBreak: 'break-word',
}

const buttonStyle: CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #1f2937',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#1f2937',
  fontSize: '12px',
  cursor: 'pointer',
}

// eslint-disable-next-line max-lines-per-function
export function RuntimeInspector({ sessionId, refreshTrigger }: RuntimeInspectorProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview')
  const [snapshot, setSnapshot] = useState<RuntimeInspectorViewModel | null>(null)
  const [liveEvents, setLiveEvents] = useState<RuntimeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (sessionId === null) {
      setSnapshot(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadRuntimeInspectorViewModel(sessionId, { eventsLimit: 20 })
      setSnapshot(data)
    } catch (nextError) {
      setError(formatApiError(nextError, 'Failed to load runtime inspector'))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load, refreshTrigger])

  useEffect(() => {
    if (sessionId === null) {
      setLiveEvents([])
      return
    }
    const subscription = subscribeToRuntimeEvents(sessionId, {
      onEvent: (event) => {
        setLiveEvents((prev) => [event, ...prev].slice(0, 30))
      },
      onError: (streamError) => {
        setError(formatApiError(streamError, 'Live event stream disconnected'))
      },
    })
    return () => {
      subscription.close()
    }
  }, [sessionId])

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string): Promise<void> => {
      if (sessionId === null) return
      setActionStatus('Running action...')
      try {
        await action()
        setActionStatus(successMessage)
        await load()
      } catch (actionError) {
        setActionStatus(formatApiError(actionError, 'Action failed'))
      }
    },
    [load, sessionId],
  )

  if (sessionId === null) {
    return <div style={panelStyle}>No active session.</div>
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <strong>Runtime Inspector</strong>
        <button type="button" style={buttonStyle} onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        {tabOrder.map((tab) => (
          <button
            key={tab}
            type="button"
            style={activeTab === tab ? activeTabButtonStyle : tabButtonStyle}
            onClick={() => {
              setActiveTab(tab)
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      {error !== null ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {snapshot !== null ? (
        <TabContent
          tab={activeTab}
          snapshot={snapshot}
          liveEvents={liveEvents}
          actionStatus={actionStatus}
          onReplayGm={() => {
            void runAction(() => replayGm(sessionId), 'GM replay scheduled')
          }}
          onRefreshMemory={() => {
            void runAction(() => refreshSessionMemory(sessionId), 'Memory refresh scheduled')
          }}
          onClearMemory={() => {
            void runAction(() => clearSessionMemory(sessionId), 'Session-scoped memory cleared')
          }}
          onResetSession={() => {
            void runAction(() => resetSession(sessionId), 'Session reset completed')
          }}
          onUpsertPersona={async (persona) => {
            await runAction(
              () => upsertUserPersona(snapshot.session.userId, persona),
              'Persona updated',
            )
          }}
        />
      ) : null}
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function, complexity
function TabContent({
  tab,
  snapshot,
  liveEvents,
  actionStatus,
  onReplayGm,
  onRefreshMemory,
  onClearMemory,
  onResetSession,
  onUpsertPersona,
}: {
  tab: InspectorTab
  snapshot: RuntimeInspectorViewModel
  liveEvents: RuntimeEvent[]
  actionStatus: string | null
  onReplayGm: () => void
  onRefreshMemory: () => void
  onClearMemory: () => void
  onResetSession: () => void
  onUpsertPersona: (persona: UserPersona) => Promise<void>
}): JSX.Element {
  if (tab === 'overview') {
    return (
      <div style={{ marginTop: '12px' }}>
        <Row label="Session">{snapshot.session.sessionId}</Row>
        <Row label="Runtime processing">{String(snapshot.runtimeState.isProcessing)}</Row>
        <Row label="Can send message">{String(snapshot.runtimeState.canSendMessage)}</Row>
        <Row label="GM progression">{snapshot.gm.gmState?.progression ?? '-'}</Row>
        <Row label="Unlocked avatars">{snapshot.gm.unlockedAvatarIds.join(', ') || 'none'}</Row>
      </div>
    )
  }

  if (tab === 'memory') {
    return (
      <div style={{ marginTop: '12px' }}>
        <Row label="Summary">{snapshot.memory.summary.summary}</Row>
        <Row label="Short-term exchanges">{String(snapshot.memory.layers.shortTerm.exchangeCount)}</Row>
        <Row label="Working avatars">{String(snapshot.memory.layers.working.avatars.length)}</Row>
        <Row label="Long-term facts">{String(snapshot.memory.layers.longTerm.facts.length)}</Row>
      </div>
    )
  }

  if (tab === 'context') {
    return (
      <div style={{ marginTop: '12px' }}>
        <Row label="Avatar context avatarId">{snapshot.context.avatar.avatarId ?? '-'}</Row>
        <Row label="Avatar recent exchanges">
          {String(snapshot.context.avatar.recentExchanges.length)}
        </Row>
        <Row label="GM recent messages">{String(snapshot.context.gm.recentMessages.length)}</Row>
        <Row label="Scenario">{snapshot.context.gm.scenario.name ?? snapshot.session.scenarioId}</Row>
      </div>
    )
  }

  if (tab === 'events') {
    return (
      <div style={{ marginTop: '12px' }}>
        <strong>Live stream</strong>
        {liveEvents.length === 0 ? <p style={{ margin: '8px 0' }}>No live events yet.</p> : null}
        {liveEvents.map((event) => (
          <div key={event.eventId} style={{ margin: '6px 0', color: '#374151' }}>
            [{new Date(event.occurredAt).toLocaleTimeString()}] {event.type}
          </div>
        ))}
        <strong>Recent snapshot events</strong>
        {snapshot.recentEvents.map((event) => (
          <div key={`${event.correlationId}-${event.createdAt}`} style={{ margin: '6px 0', color: '#374151' }}>
            [{new Date(event.createdAt).toLocaleTimeString()}] {event.type}
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'metrics') {
    return (
      <div style={{ marginTop: '12px' }}>
        <Row label="Total turns">{String(snapshot.metrics.summary.totalTurns)}</Row>
        <Row label="Turns with GM">{String(snapshot.metrics.summary.turnsWithGm)}</Row>
        <Row label="Avg avatar latency (ms)">
          {String(snapshot.metrics.summary.avgAvatarLatencyMs)}
        </Row>
        <Row label="Avg total latency (ms)">
          {String(snapshot.metrics.summary.avgTotalTurnLatencyMs)}
        </Row>
      </div>
    )
  }

  if (tab === 'persona') {
    return <PersonaEditor persona={snapshot.persona} onSave={onUpsertPersona} />
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button type="button" style={buttonStyle} onClick={onResetSession}>
          Reset session
        </button>
        <button type="button" style={buttonStyle} onClick={onReplayGm}>
          Replay GM
        </button>
        <button type="button" style={buttonStyle} onClick={onRefreshMemory}>
          Refresh memory
        </button>
        <button type="button" style={buttonStyle} onClick={onClearMemory}>
          Clear session memory
        </button>
      </div>
      {actionStatus !== null ? <p style={{ marginBottom: 0 }}>{actionStatus}</p> : null}
    </div>
  )
}

function PersonaEditor({
  persona,
  onSave,
}: {
  persona: UserPersona | null
  onSave: (persona: UserPersona) => Promise<void>
}): JSX.Element {
  const [role, setRole] = useState(persona?.role ?? '')
  const [tone, setTone] = useState(persona?.tonePreference ?? '')
  const [hints, setHints] = useState((persona?.interactionHints ?? []).join('\n'))
  const payload = useMemo(
    () => ({
      ...(role.trim() ? { role: role.trim() } : {}),
      ...(tone.trim() ? { tonePreference: tone.trim() } : {}),
      ...(hints.trim()
        ? { interactionHints: hints.split('\n').map((item) => item.trim()).filter(Boolean) }
        : {}),
    }),
    [hints, role, tone],
  )

  return (
    <form
      style={{ marginTop: '12px', display: 'grid', gap: '8px' }}
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(payload)
      }}
    >
      <label>
        Role
        <input
          value={role}
          onChange={(event) => {
            setRole(event.target.value)
          }}
        />
      </label>
      <label>
        Tone
        <input
          value={tone}
          onChange={(event) => {
            setTone(event.target.value)
          }}
        />
      </label>
      <label>
        Hints (one per line)
        <textarea
          value={hints}
          onChange={(event) => {
            setHints(event.target.value)
          }}
          rows={4}
        />
      </label>
      <button type="submit" style={buttonStyle}>
        Save persona
      </button>
    </form>
  )
}

function Row({ label, children }: { label: string; children: string }): JSX.Element {
  return (
    <div style={rowStyle}>
      <span style={keyStyle}>{label}</span>
      <span style={valueStyle}>{children}</span>
    </div>
  )
}
