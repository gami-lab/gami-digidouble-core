import { useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { RuntimeEvent, UserPersona } from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'
import { buildGmImpactTrace } from './gm-impact-trace'
import type { MemoryEvolutionSnapshot } from './memory-evolution'
import { computeMemoryDelta } from './memory-evolution'
import {
  applyTurnProfilerFilter,
  buildTurnProfilerRows,
  describeTurnLatency,
  describeTurnTokens,
} from './turn-profiler'

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
  memoryHistory: MemoryEvolutionSnapshot[]
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
      return <MemoryTab snapshot={props.snapshot} memoryHistory={props.memoryHistory} />
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

// eslint-disable-next-line complexity
function MemoryTab({
  snapshot,
  memoryHistory,
}: {
  snapshot: RuntimeInspectorViewModel
  memoryHistory: MemoryEvolutionSnapshot[]
}): JSX.Element {
  const lastSnapshot = memoryHistory[memoryHistory.length - 1] ?? null
  const previousSnapshot =
    memoryHistory.length >= 2 ? (memoryHistory[memoryHistory.length - 2] ?? null) : null
  const delta =
    lastSnapshot !== null ? computeMemoryDelta(previousSnapshot, lastSnapshot) : null

  return (
    <div style={{ marginTop: '12px' }}>
      <strong>Short-term exchange memory</strong>
      <Row label="Exchange count">{String(snapshot.memory.layers.shortTerm.exchangeCount)}</Row>
      <Row label="Recent exchanges">{String(snapshot.memory.layers.shortTerm.recentExchanges.length)}</Row>
      {snapshot.memory.layers.shortTerm.recentExchanges.map((exchange, index) => (
        <p key={`${exchange.user}-${exchange.avatar}-${String(index)}`} style={{ margin: '4px 0', color: '#374151' }}>
          U: {exchange.user} / A: {exchange.avatar}
        </p>
      ))}

      <strong style={{ display: 'block', marginTop: '12px' }}>Working memory</strong>
      <Row label="Session summary">{snapshot.memory.layers.working.session?.summary ?? '-'}</Row>
      <Row label="Avatar summaries">{String(snapshot.memory.layers.working.avatars.length)}</Row>
      {snapshot.memory.layers.working.avatars.map((avatar) => (
        <p key={avatar.avatarId} style={{ margin: '4px 0', color: '#374151' }}>
          {avatar.avatarId}: {avatar.summary}
        </p>
      ))}

      <strong style={{ display: 'block', marginTop: '12px' }}>Long-term facts</strong>
      <Row label="Fact count">{String(snapshot.memory.layers.longTerm.facts.length)}</Row>
      {snapshot.memory.layers.longTerm.facts.map((fact) => (
        <p key={`${fact.category}:${fact.key}`} style={{ margin: '4px 0', color: '#374151' }}>
          {fact.category}/{fact.key}: {fact.value}
        </p>
      ))}

      <strong style={{ display: 'block', marginTop: '12px' }}>Memory evolution</strong>
      {memoryHistory.length === 0 ? (
        <p style={{ margin: '6px 0', color: '#6b7280' }}>No memory snapshots yet.</p>
      ) : null}
      {delta !== null ? (
        <>
          <Row
            label="Progress marker"
          >{`turn ${String(lastSnapshot?.turnIndex ?? 0)} / ${lastSnapshot?.conversationId ?? '-'}`}</Row>
          <Row
            label="Delta summary"
          >{`short-term +${String(delta.shortTerm.added.length)} -${String(delta.shortTerm.removed.length)}, working +${String(delta.working.avatarAdded.length)} ~${String(delta.working.avatarChanged.length)} -${String(delta.working.avatarRemoved.length)}, long-term +${String(delta.longTerm.added.length)} ~${String(delta.longTerm.changed.length)} -${String(delta.longTerm.removed.length)}`}</Row>
          {delta.working.stale ? (
            <p style={{ margin: '6px 0', color: '#b45309' }}>
              Working memory stale: turn advanced but working summaries did not update.
            </p>
          ) : null}
          {delta.longTerm.added.length > 0 ? (
            <p style={{ margin: '6px 0', color: '#166534' }}>
              New long-term fact extracted: {delta.longTerm.added.map((fact) => `${fact.category}:${fact.key}`).join(', ')}
            </p>
          ) : null}
        </>
      ) : null}
      <div style={{ marginTop: '8px' }}>
        {memoryHistory
          .slice()
          .reverse()
          .map((entry) => (
            <p key={entry.snapshotId} style={{ margin: '4px 0', color: '#4b5563' }}>
              [{new Date(entry.capturedAt).toLocaleTimeString()}] turn {String(entry.turnIndex ?? 0)} ·
              short-term {String(entry.layers.shortTerm.exchangeCount)} · facts {String(entry.layers.longTerm.facts.length)}
            </p>
          ))}
      </div>
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
  const trace = buildGmImpactTrace(snapshot)

  return (
    <div style={{ marginTop: '12px' }}>
      <strong>GM causality trace</strong>
      {trace.length === 0 ? (
        <p style={{ margin: '8px 0' }}>No GM causality entries yet.</p>
      ) : (
        trace.map((entry) => (
          <div
            key={`${entry.correlationId}-${entry.createdAt}`}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              padding: '8px',
              margin: '8px 0',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>
              Turn {String(entry.turnIndex ?? 0)} · timeline {entry.timelinePosition} · {entry.status}
            </p>
            <p style={{ margin: '4px 0', color: '#4b5563' }}>Correlation: {entry.correlationId}</p>
            <p style={{ margin: '4px 0' }}>
              <strong>Trigger/context:</strong> {entry.triggerContext}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>GM decision/action:</strong>
            </p>
            {entry.gmDecisionAction.map((line, index) => (
              <p key={`${entry.correlationId}-decision-${String(index)}`} style={{ margin: '2px 0', color: '#374151' }}>
                - {line}
              </p>
            ))}
            <p style={{ margin: '4px 0' }}>
              <strong>Resulting impact:</strong>
            </p>
            {entry.resultingImpact.map((line, index) => (
              <p key={`${entry.correlationId}-impact-${String(index)}`} style={{ margin: '2px 0', color: '#374151' }}>
                - {line}
              </p>
            ))}
          </div>
        ))
      )}
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
  const [gmOnly, setGmOnly] = useState(false)
  const [sort, setSort] = useState<'slowest-total' | 'slowest-avatar' | 'latest-turn'>(
    'slowest-total',
  )

  const rows = buildTurnProfilerRows(snapshot.metrics.turns, snapshot.recentEvents)
  const visibleRows = applyTurnProfilerFilter(rows, {
    gmOnly,
    sort,
    limit: 20,
  })

  return (
    <div style={{ marginTop: '12px' }}>
      <Row label="Total turns">{String(snapshot.metrics.summary.totalTurns)}</Row>
      <Row label="Turns with GM">{String(snapshot.metrics.summary.turnsWithGm)}</Row>
      <Row label="Avg avatar latency (ms)">{String(snapshot.metrics.summary.avgAvatarLatencyMs)}</Row>
      <Row label="Avg total latency (ms)">{String(snapshot.metrics.summary.avgTotalTurnLatencyMs)}</Row>
      <strong style={{ display: 'block', marginTop: '12px' }}>Turn profiler</strong>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as 'slowest-total' | 'slowest-avatar' | 'latest-turn')
            }}
          >
            <option value="slowest-total">Slowest total</option>
            <option value="slowest-avatar">Slowest avatar</option>
            <option value="latest-turn">Latest turn</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={gmOnly}
            onChange={(event) => {
              setGmOnly(event.target.checked)
            }}
          />
          GM involved only
        </label>
      </div>
      {visibleRows.length === 0 ? (
        <p style={{ margin: '8px 0', color: '#6b7280' }}>No turns match the current filter.</p>
      ) : (
        visibleRows.map((row) => (
          <div
            key={row.correlationId}
            style={{
              marginTop: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              padding: '8px',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>
              Turn {String(row.turnIndex)} · {row.conversationId ?? 'unknown conversation'} · {row.hasGm ? 'GM' : 'Avatar only'}
            </p>
            <p style={{ margin: '4px 0', color: '#374151' }}>{describeTurnLatency(row)}</p>
            <p style={{ margin: '4px 0', color: '#374151' }}>{describeTurnTokens(row)}</p>
            <p style={{ margin: '4px 0', color: '#4b5563' }}>Correlation: {row.correlationId}</p>
          </div>
        ))
      )}
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
