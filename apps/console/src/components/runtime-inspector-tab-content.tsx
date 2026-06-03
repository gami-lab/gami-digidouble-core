/* eslint-disable max-lines */
import { useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { GmSessionEventPayload, RuntimeEvent, UserPersona } from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'
import { buildGmImpactTrace } from './gm-impact-trace'
import type { MemoryEvolutionSnapshot } from './memory-evolution'
import { computeMemoryDelta } from './memory-evolution'
import {
  formatGmKnowledgeCounts,
  formatTraceKeptTrimmed,
  formatTraceRetrievalCounts,
  formatTraceVisibilityExcludedCounts,
  formatTraceVisibilityGmRetrievalCounts,
  formatVisibility,
} from './runtime-inspector-context-formatters'
import { buildPersonaPayload, PersonaEditor } from './runtime-inspector-persona'
import { MemoryObservabilitySection } from './runtime-inspector-memory-observability'
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
      return (
        <PersonaEditor
          persona={props.snapshot.persona}
          onSave={props.onUpsertPersona}
          buttonStyle={buttonStyle}
        />
      )
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
  const latestGmDecision = findLatestGmDecision(snapshot.recentEvents)

  return (
    <div style={{ marginTop: '12px' }}>
      <Row label="Session">{snapshot.session.sessionId}</Row>
      <Row label="Runtime processing">{String(snapshot.runtimeState.isProcessing)}</Row>
      <Row label="Can send message">{String(snapshot.runtimeState.canSendMessage)}</Row>
      <Row label="GM progression">{snapshot.gm.gmState?.progression ?? '-'}</Row>
      <Row label="Unlocked avatars">{formatUnlockedAvatars(snapshot)}</Row>
      <Row label="GM recommendation">{formatSuggestedAvatar(snapshot, latestGmDecision)}</Row>
      <Row label="GM next-turn note">{snapshot.gm.gmNotes ?? '-'}</Row>
      <strong style={{ display: 'block', marginTop: '12px' }}>Effective models</strong>
      <Row label="Avatar">{`${snapshot.effectiveModels.avatar.provider} / ${snapshot.effectiveModels.avatar.model}`}</Row>
      <Row label="Game Master">{`${snapshot.effectiveModels.gameMaster.provider} / ${snapshot.effectiveModels.gameMaster.model}`}</Row>
      <Row label="Memory">{`${snapshot.effectiveModels.memory.provider} / ${snapshot.effectiveModels.memory.model}`}</Row>
    </div>
  )
}

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
  const delta = lastSnapshot !== null ? computeMemoryDelta(previousSnapshot, lastSnapshot) : null

  return (
    <div style={{ marginTop: '12px' }}>
      {renderShortTermMemory(snapshot)}
      {renderWorkingMemory(snapshot)}
      {renderLongTermMemory(snapshot)}
      {renderMemoryEvolution(memoryHistory, delta, lastSnapshot)}
      <MemoryObservabilitySection layers={snapshot.memory.layers} />
    </div>
  )
}

function renderShortTermMemory(snapshot: RuntimeInspectorViewModel): JSX.Element {
  return (
    <>
      <strong>Short-term exchange memory</strong>
      <Row label="Exchange count">{String(snapshot.memory.layers.shortTerm.exchangeCount)}</Row>
      <Row label="Recent exchanges">
        {String(snapshot.memory.layers.shortTerm.recentExchanges.length)}
      </Row>
      {snapshot.memory.layers.shortTerm.recentExchanges.map((exchange, index) => (
        <p
          key={`${exchange.user}-${exchange.avatar}-${String(index)}`}
          style={{ margin: '4px 0', color: '#374151' }}
        >
          U: {exchange.user} / A: {exchange.avatar}
        </p>
      ))}
    </>
  )
}

// eslint-disable-next-line complexity
function renderWorkingMemory(snapshot: RuntimeInspectorViewModel): JSX.Element {
  return (
    <>
      <strong style={{ display: 'block', marginTop: '12px' }}>Working memory</strong>
      <Row label="Active avatar">{snapshot.memory.layers.activeAvatarId ?? '-'}</Row>
      <Row label="Working summary">{snapshot.memory.layers.working.current?.summary ?? '-'}</Row>
      <Row label="Working updated at">
        {snapshot.memory.layers.working.current?.updatedAt ?? '-'}
      </Row>
      <Row label="Unresolved threads">
        {String(snapshot.memory.layers.working.current?.unresolvedThreads.length ?? 0)}
      </Row>
      <Row label="Candidate facts">
        {String(snapshot.memory.layers.working.current?.candidateFacts.length ?? 0)}
      </Row>
      <Row label="Session memory updated at">
        {snapshot.memory.layers.working.session?.updatedAt ?? '-'}
      </Row>
      <Row label="Avatar memory summaries">
        {snapshot.memory.layers.working.avatars.length > 0
          ? snapshot.memory.layers.working.avatars
              .map((avatar) => `${avatar.avatarId} @ ${avatar.updatedAt}`)
              .join(', ')
          : 'none'}
      </Row>
    </>
  )
}

function renderLongTermMemory(snapshot: RuntimeInspectorViewModel): JSX.Element {
  return (
    <>
      <strong style={{ display: 'block', marginTop: '12px' }}>Long-term avatar memories</strong>
      <Row label="Avatar count">{String(snapshot.memory.layers.longTerm.avatars.length)}</Row>
      <Row label="Memory count">
        {String(
          snapshot.memory.layers.longTerm.avatars.reduce(
            (total, avatar) => total + avatar.memories.length,
            0,
          ),
        )}
      </Row>
      <Row label="Fact count">{String(snapshot.memory.layers.longTerm.facts.length)}</Row>
      {snapshot.memory.layers.longTerm.avatars.map((avatar) => (
        <div key={avatar.avatarId} style={{ margin: '8px 0' }}>
          <strong>{avatar.avatarId}</strong>
          {avatar.memories.map((memory) => (
            <p key={memory.conversationId} style={{ margin: '4px 0', color: '#374151' }}>
              {memory.conversationId} [{memory.createdAt}]: {memory.summary}
            </p>
          ))}
        </div>
      ))}
      {snapshot.memory.layers.longTerm.facts.map((fact) => (
        <p
          key={`${fact.category}-${fact.key}-${fact.updatedAt}`}
          style={{ margin: '4px 0', color: '#374151' }}
        >
          [{fact.updatedAt}] {fact.category}.{fact.key}: {fact.value}
        </p>
      ))}
    </>
  )
}

function renderMemoryEvolution(
  memoryHistory: MemoryEvolutionSnapshot[],
  delta: ReturnType<typeof computeMemoryDelta> | null,
  lastSnapshot: MemoryEvolutionSnapshot | null,
): JSX.Element {
  return (
    <>
      <strong style={{ display: 'block', marginTop: '12px' }}>Memory evolution</strong>
      {memoryHistory.length === 0 ? (
        <p style={{ margin: '6px 0', color: '#6b7280' }}>No memory snapshots yet.</p>
      ) : null}
      {delta !== null ? (
        <>
          <Row label="Progress marker">{`turn ${String(lastSnapshot?.turnIndex ?? 0)} / ${lastSnapshot?.conversationId ?? '-'}`}</Row>
          <Row label="Delta summary">{`short-term +${String(delta.shortTerm.added.length)} -${String(delta.shortTerm.removed.length)}, working +${String(delta.working.avatarAdded.length)} ~${String(delta.working.avatarChanged.length)} -${String(delta.working.avatarRemoved.length)}, long-term +${String(delta.longTerm.added.length)} ~${String(delta.longTerm.changed.length)} -${String(delta.longTerm.removed.length)}`}</Row>
          {delta.working.stale ? (
            <p style={{ margin: '6px 0', color: '#b45309' }}>
              Working memory stale: turn advanced but working summaries did not update.
            </p>
          ) : null}
          {delta.longTerm.added.length > 0 ? (
            <p style={{ margin: '6px 0', color: '#166534' }}>
              New long-term avatar memory stored:{' '}
              {delta.longTerm.added
                .map((memory) => `${memory.avatarId}:${memory.conversationId}`)
                .join(', ')}
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
              [{new Date(entry.capturedAt).toLocaleTimeString()}] turn{' '}
              {String(entry.turnIndex ?? 0)} · short-term{' '}
              {String(entry.layers.shortTerm.exchangeCount)} · facts{' '}
              {String(
                entry.layers.longTerm.avatars.reduce(
                  (total, avatar) => total + avatar.memories.length,
                  0,
                ),
              )}
            </p>
          ))}
      </div>
    </>
  )
}

// eslint-disable-next-line complexity
function ContextTab({ snapshot }: { snapshot: RuntimeInspectorViewModel }): JSX.Element {
  const avatarKnowledge = snapshot.context.avatar.knowledge?.retrievedItems ?? []
  const gmKnowledge = snapshot.context.gm.knowledge
  const trace = snapshot.context.trace
  const gmCounts = formatGmKnowledgeCounts(gmKnowledge)
  const traceDeterministic = trace?.deterministic === true ? 'true' : 'false'
  const traceKeptTrimmed = formatTraceKeptTrimmed(trace)
  const traceRetrievalCounts = formatTraceRetrievalCounts(trace)
  const traceVisibilityExcluded = formatTraceVisibilityExcludedCounts(trace)
  const traceVisibilityGmUnrestricted = trace?.selectedInputs.visibility?.gmUnrestricted === true
    ? 'true'
    : 'false'
  const traceVisibilityGmRetrieval = formatTraceVisibilityGmRetrievalCounts(trace)

  return (
    <div style={{ marginTop: '12px' }}>
      <p style={{ margin: '0 0 10px', color: '#4b5563' }}>
        This is the bounded context assembled before the Avatar and Game Master calls. It explains
        what memory, retrieval, persona, and directives were kept or trimmed for the current turn.
      </p>
      <Row label="Avatar assembled for">{snapshot.context.avatar.avatarId ?? '-'}</Row>
      <Row label="Avatar exchange window">
        {String(snapshot.context.avatar.recentExchanges.length)}
      </Row>
      <Row label="GM recent message window">{String(snapshot.context.gm.recentMessages.length)}</Row>
      <Row label="Scenario">{snapshot.context.gm.scenario.name ?? snapshot.session.scenarioId}</Row>
      <Row label="Avatar knowledge items">{String(avatarKnowledge.length)}</Row>
      <Row label="GM memory/world/media">{gmCounts}</Row>
      <Row label="Deterministic assembly">{traceDeterministic}</Row>
      <Row label="Protected segments">{trace?.policy.protectedSegments.join(', ') || '-'}</Row>
      <Row label="Kept / trimmed segments">{traceKeptTrimmed}</Row>
      <Row label="Selected retrieval memory/world/media">{traceRetrievalCounts}</Row>
      <Row label="Excluded by visibility memory/world/media">{traceVisibilityExcluded}</Row>
      <Row label="GM visibility unrestricted">{traceVisibilityGmUnrestricted}</Row>
      <Row label="GM retrieval memory/world/media">
        {traceVisibilityGmRetrieval}
      </Row>
      {avatarKnowledge.slice(0, 3).map((item) => (
        <p key={`${item.sourceId}-${item.chunkId}`} style={{ margin: '4px 0', color: '#374151' }}>
          [{item.knowledgeType}] [visibility:{formatVisibility(item.visibleToAvatarIds)}]{' '}
          {truncateText(item.content, 160)}
        </p>
      ))}
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
              Turn {String(entry.turnIndex ?? 0)} · timeline {entry.timelinePosition} ·{' '}
              {entry.status}
            </p>
            <p style={{ margin: '4px 0', color: '#4b5563' }}>Correlation: {entry.correlationId}</p>
            <p style={{ margin: '4px 0' }}>
              <strong>Trigger/context:</strong> {entry.triggerContext}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>GM decision/action:</strong>
            </p>
            {entry.gmDecisionAction.map((line, index) => (
              <p
                key={`${entry.correlationId}-decision-${String(index)}`}
                style={{ margin: '2px 0', color: '#374151' }}
              >
                - {line}
              </p>
            ))}
            <p style={{ margin: '4px 0' }}>
              <strong>Resulting impact:</strong>
            </p>
            {entry.resultingImpact.map((line, index) => (
              <p
                key={`${entry.correlationId}-impact-${String(index)}`}
                style={{ margin: '2px 0', color: '#374151' }}
              >
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
        <div
          key={`${event.correlationId}-${event.createdAt}`}
          style={{ margin: '6px 0', color: '#374151' }}
        >
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
      <Row label="Avg avatar latency (ms)">
        {String(snapshot.metrics.summary.avgAvatarLatencyMs)}
      </Row>
      <Row label="Avg total latency (ms)">
        {String(snapshot.metrics.summary.avgTotalTurnLatencyMs)}
      </Row>
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
              Turn {String(row.turnIndex)} · {row.conversationId} · {row.hasGm ? 'GM' : 'Avatar only'}
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

export { buildPersonaPayload }

function Row({ label, children }: { label: string; children: string }): JSX.Element {
  return (
    <div style={rowStyle}>
      <span style={keyStyle}>{label}</span>
      <span style={valueStyle}>{children}</span>
    </div>
  )
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

function findLatestGmDecision(
  events: RuntimeInspectorViewModel['recentEvents'],
): GmSessionEventPayload['decision'] | null {
  const latestGmEvent = events.find((event) => event.type === 'gm_triggered')
  if (latestGmEvent?.type !== 'gm_triggered') return null
  return 'decision' in latestGmEvent.payload ? (latestGmEvent.payload.decision ?? null) : null
}

function formatUnlockedAvatars(snapshot: RuntimeInspectorViewModel): string {
  if (snapshot.gm.unlockedAvatarIds.length === 0) return 'none'
  const avatarNameById = new Map(
    snapshot.context.gm.availableAvatars.map((avatar) => [avatar.avatarId, avatar.name] as const),
  )
  return snapshot.gm.unlockedAvatarIds
    .map((avatarId) => `${avatarId} (${avatarNameById.get(avatarId) ?? 'unknown'})`)
    .join(', ')
}

function formatSuggestedAvatar(
  snapshot: RuntimeInspectorViewModel,
  decision: GmSessionEventPayload['decision'] | null,
): string {
  if (decision?.suggestedAvatarId === undefined) return '-'
  const avatarName =
    snapshot.context.gm.availableAvatars.find((avatar) => avatar.avatarId === decision.suggestedAvatarId)
      ?.name ?? 'unknown'
  const reason = decision.suggestedAvatarReason ?? 'no reason recorded'
  return `${decision.suggestedAvatarId} (${avatarName}) — ${reason}`
}
