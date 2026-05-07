import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { loadRuntimeInspectorViewModel } from '../api'
import type { InspectSessionResponse, SessionEventRecord, SessionTransitionRecord } from '../api'
import { formatApiError } from '../api/error'

export async function loadGmDebugPanelData(sessionId: string): Promise<{
  inspect: InspectSessionResponse['inspect']
  events: SessionEventRecord[]
}> {
  const snapshot = await loadRuntimeInspectorViewModel(sessionId, { eventsLimit: 20 })
  return {
    inspect: {
      session: snapshot.session,
      gmState: snapshot.gm.gmState,
      transitionHistory: snapshot.gm.transitionHistory,
      unlockedAvatarIds: snapshot.gm.unlockedAvatarIds,
      gmNotes: snapshot.gm.gmNotes,
    },
    events: snapshot.recentEvents,
  }
}

type GmDebugPanelProps = {
  sessionId: string | null
  refreshTrigger: number
}

type PanelState = {
  inspect: InspectSessionResponse['inspect'] | null
  events: SessionEventRecord[]
  loading: boolean
  error: string | null
}

const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
  fontSize: '13px',
}

const sectionTitleStyle: CSSProperties = {
  margin: '14px 0 6px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#374151',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '6px',
  alignItems: 'flex-start',
}

const labelStyle: CSSProperties = {
  fontWeight: 600,
  color: '#374151',
  flexShrink: 0,
  width: '110px',
}

const mutedStyle: CSSProperties = {
  color: '#6b7280',
}

const refreshButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #1f2937',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#1f2937',
  cursor: 'pointer',
  fontSize: '12px',
}

const errorStyle: CSSProperties = {
  color: '#b91c1c',
  margin: '8px 0 0',
}

export function GmDebugPanel({ sessionId, refreshTrigger }: GmDebugPanelProps): JSX.Element {
  const [state, setState] = useState<PanelState>({
    inspect: null,
    events: [],
    loading: false,
    error: null,
  })

  const refresh = useCallback((): void => {
    if (sessionId === null) {
      setState({ inspect: null, events: [], loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))
    void (async () => {
      try {
        const data = await loadGmDebugPanelData(sessionId)
        setState({ inspect: data.inspect, events: data.events, loading: false, error: null })
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatApiError(error, 'Failed to load GM debug state'),
        }))
      }
    })()
  }, [sessionId])

  useEffect(() => {
    refresh()
  }, [refresh, refreshTrigger])

  if (sessionId === null) {
    return <PlaceholderPanel />
  }

  return (
    <div style={panelStyle}>
      <PanelHeader loading={state.loading} onRefresh={refresh} />
      {state.error !== null ? <p style={errorStyle}>{state.error}</p> : null}
      <StateSummary inspect={state.inspect} />
      <TransitionHistory transitions={state.inspect?.transitionHistory ?? []} />
      <RecentEvents events={state.events} />
    </div>
  )
}

function PlaceholderPanel(): JSX.Element {
  return (
    <div style={panelStyle}>
      <p style={{ ...mutedStyle, margin: 0 }}>No active session</p>
    </div>
  )
}

function PanelHeader({
  loading,
  onRefresh,
}: {
  loading: boolean
  onRefresh: () => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <strong>GM Debug</strong>
      <button type="button" style={refreshButtonStyle} onClick={onRefresh} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )
}

function StateSummary({ inspect }: { inspect: PanelState['inspect'] }): JSX.Element {
  const activeAvatar = inspect?.gmState?.currentAvatarId ?? inspect?.session.activeAvatarId ?? '-'
  const unlocked = inspect?.unlockedAvatarIds.join(', ') || 'none'
  const notes = inspect?.gmNotes ?? '-'

  return (
    <div>
      <div style={sectionTitleStyle}>State</div>
      <InfoRow label="Active avatar" value={activeAvatar} />
      <InfoRow label="Unlocked" value={unlocked} />
      <InfoRow label="GM notes" value={notes} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: '#111827', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function TransitionHistory({
  transitions,
}: {
  transitions: SessionTransitionRecord[]
}): JSX.Element {
  return (
    <div>
      <div style={sectionTitleStyle}>Transition History</div>
      {transitions.length === 0 ? <p style={mutedStyle}>none</p> : null}
      {transitions.map((transition) => (
        <div key={`${transition.transitionedAt}-${transition.toAvatarId}`} style={mutedStyle}>
          {transition.fromAvatarId ?? 'start'} {'->'} {transition.toAvatarId} (
          {transition.reason ?? 'no reason'}, {transition.startedBy ?? 'unknown'},{' '}
          {new Date(transition.transitionedAt).toLocaleTimeString()})
        </div>
      ))}
    </div>
  )
}

function RecentEvents({ events }: { events: SessionEventRecord[] }): JSX.Element {
  return (
    <div>
      <div style={sectionTitleStyle}>Recent GM Events</div>
      {events.length === 0 ? <p style={mutedStyle}>none</p> : null}
      {events.map((event) => (
        <div key={`${event.createdAt}-${event.correlationId}`} style={mutedStyle}>
          [{new Date(event.createdAt).toLocaleTimeString()}] {formatEventLine(event)}
        </div>
      ))}
    </div>
  )
}

function formatEventLine(event: SessionEventRecord): string {
  if ('totalTurnLatencyMs' in event.payload) {
    return `${event.type} turn=${event.payload.turnIndex} total=${event.payload.totalTurnLatencyMs} ms`
  }
  return `${event.type} ${event.payload.triggerReason ?? 'none'} ${event.payload.latencyMs} ms`
}
