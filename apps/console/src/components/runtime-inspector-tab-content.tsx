import { useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { RuntimeEvent, UserPersona } from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'

export type InspectorTab =
  | 'overview'
  | 'memory'
  | 'context'
  | 'events'
  | 'metrics'
  | 'persona'
  | 'actions'

type RuntimeInspectorTabContentProps = {
  tab: InspectorTab
  snapshot: RuntimeInspectorViewModel
  liveEvents: RuntimeEvent[]
  actionStatus: string | null
  onReplayGm: () => void
  onRefreshMemory: () => void
  onClearMemory: () => void
  onResetSession: () => void
  onUpsertPersona: (persona: UserPersona) => Promise<void>
}

type PersonaDraft = {
  role: string
  tonePreference: string
  hintsText: string
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

export function RuntimeInspectorTabContent(props: RuntimeInspectorTabContentProps): JSX.Element {
  switch (props.tab) {
    case 'overview':
      return <OverviewTab snapshot={props.snapshot} />
    case 'memory':
      return <MemoryTab snapshot={props.snapshot} />
    case 'context':
      return <ContextTab snapshot={props.snapshot} />
    case 'events':
      return <EventsTab snapshot={props.snapshot} liveEvents={props.liveEvents} />
    case 'metrics':
      return <MetricsTab snapshot={props.snapshot} />
    case 'persona':
      return <PersonaEditor persona={props.snapshot.persona} onSave={props.onUpsertPersona} />
    default:
      return (
        <ActionsTab
          actionStatus={props.actionStatus}
          onReplayGm={props.onReplayGm}
          onRefreshMemory={props.onRefreshMemory}
          onClearMemory={props.onClearMemory}
          onResetSession={props.onResetSession}
        />
      )
  }
}

function OverviewTab({ snapshot }: { snapshot: RuntimeInspectorViewModel }): JSX.Element {
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

function MemoryTab({ snapshot }: { snapshot: RuntimeInspectorViewModel }): JSX.Element {
  return (
    <div style={{ marginTop: '12px' }}>
      <Row label="Summary">{snapshot.memory.summary.summary}</Row>
      <Row label="Short-term exchanges">{String(snapshot.memory.layers.shortTerm.exchangeCount)}</Row>
      <Row label="Working avatars">{String(snapshot.memory.layers.working.avatars.length)}</Row>
      <Row label="Long-term facts">{String(snapshot.memory.layers.longTerm.facts.length)}</Row>
    </div>
  )
}

function ContextTab({ snapshot }: { snapshot: RuntimeInspectorViewModel }): JSX.Element {
  return (
    <div style={{ marginTop: '12px' }}>
      <Row label="Avatar context avatarId">{snapshot.context.avatar.avatarId ?? '-'}</Row>
      <Row label="Avatar recent exchanges">{String(snapshot.context.avatar.recentExchanges.length)}</Row>
      <Row label="GM recent messages">{String(snapshot.context.gm.recentMessages.length)}</Row>
      <Row label="Scenario">{snapshot.context.gm.scenario.name ?? snapshot.session.scenarioId}</Row>
    </div>
  )
}

function EventsTab({
  snapshot,
  liveEvents,
}: {
  snapshot: RuntimeInspectorViewModel
  liveEvents: RuntimeEvent[]
}): JSX.Element {
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

function MetricsTab({ snapshot }: { snapshot: RuntimeInspectorViewModel }): JSX.Element {
  return (
    <div style={{ marginTop: '12px' }}>
      <Row label="Total turns">{String(snapshot.metrics.summary.totalTurns)}</Row>
      <Row label="Turns with GM">{String(snapshot.metrics.summary.turnsWithGm)}</Row>
      <Row label="Avg avatar latency (ms)">{String(snapshot.metrics.summary.avgAvatarLatencyMs)}</Row>
      <Row label="Avg total latency (ms)">{String(snapshot.metrics.summary.avgTotalTurnLatencyMs)}</Row>
    </div>
  )
}

function ActionsTab({
  actionStatus,
  onReplayGm,
  onRefreshMemory,
  onClearMemory,
  onResetSession,
}: {
  actionStatus: string | null
  onReplayGm: () => void
  onRefreshMemory: () => void
  onClearMemory: () => void
  onResetSession: () => void
}): JSX.Element {
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
  const [draft, setDraft] = useState<PersonaDraft>({
    role: persona?.role ?? '',
    tonePreference: persona?.tonePreference ?? '',
    hintsText: (persona?.interactionHints ?? []).join('\n'),
  })

  return (
    <form
      style={{ marginTop: '12px', display: 'grid', gap: '8px' }}
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(buildPersonaPayload(draft))
      }}
    >
      <label>
        Role
        <input
          value={draft.role}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, role: event.target.value }))
          }}
        />
      </label>
      <label>
        Tone
        <input
          value={draft.tonePreference}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, tonePreference: event.target.value }))
          }}
        />
      </label>
      <label>
        Hints (one per line)
        <textarea
          value={draft.hintsText}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, hintsText: event.target.value }))
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

export function buildPersonaPayload(draft: PersonaDraft): UserPersona {
  const hints = draft.hintsText
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return {
    ...(draft.role.trim().length > 0 ? { role: draft.role.trim() } : {}),
    ...(draft.tonePreference.trim().length > 0
      ? { tonePreference: draft.tonePreference.trim() }
      : {}),
    ...(hints.length > 0 ? { interactionHints: hints } : {}),
  }
}

function Row({ label, children }: { label: string; children: string }): JSX.Element {
  return (
    <div style={rowStyle}>
      <span style={keyStyle}>{label}</span>
      <span style={valueStyle}>{children}</span>
    </div>
  )
}
