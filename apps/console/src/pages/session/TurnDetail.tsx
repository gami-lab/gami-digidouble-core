import type { JSX } from 'react'
import type { TurnCompletedEventPayload } from '@gami/shared'
import { formatMs, formatTime, formatTokens } from '../../debug/format'
import type { RetrievedByType } from '../../debug/RetrievalView'
import { RetrievalView } from '../../debug/RetrievalView'
import {
  backgroundLabel,
  type AudioRun,
  type BackgroundEntry,
  type TurnEntry,
} from '../../debug/session-timeline'
import {
  turnFirstReplyMs,
  turnLatencySegments,
  turnVoiceReadyMs,
  turnVoiceStartMs,
  turnWaitMs,
} from '../../debug/turn-latency'
import {
  Badge,
  Empty,
  KeyValues,
  LangfuseTraceLink,
  LatencyBar,
  LatencyLegend,
  Section,
  TextList,
} from '../../ui/ui'
import { AvatarContextView } from './AvatarContextView'
import { GmRunView, gmSummary } from './GmRunView'
import { ConsolidationView, MemoryRunView } from './MemoryRunView'
import { avatarName } from './SessionHeader'
import type { SessionData } from './use-session-data'

// eslint-disable-next-line complexity -- render-only branching
export function TurnDetail({ entry, data }: { entry: TurnEntry; data: SessionData }): JSX.Element {
  const { turn } = entry
  const retrieved = turn.avatarContext?.sections.retrievedContext
  const trace = retrieved?.trace ?? turn.contextSelection?.retrieval?.retrievalTrace
  const items: RetrievedByType = {
    avatar_knowledge: retrieved?.avatar_knowledge ?? [],
    world: retrieved?.world ?? [],
    media: retrieved?.media ?? [],
  }
  const chunkCount = items.avatar_knowledge.length + items.world.length + items.media.length
  const plan = turn.consumedGmRetrievalPlan

  return (
    <div className="stack">
      <TurnHeader entry={entry} data={data} />

      <Section
        defaultOpen
        title="Latency"
        aside={
          <span className="small">
            {turnFirstReplyMs(turn) !== undefined
              ? `first words after ${formatMs(turnFirstReplyMs(turn))} · `
              : ''}
            full text after {formatMs(turnWaitMs(turn))}
            {voiceWaitLabel(turn, entry.audio)}
          </span>
        }
      >
        <LatencyBar segments={turnLatencySegments(turn, entry.audio)} />
        <LatencyLegend segments={turnLatencySegments(turn, entry.audio)} />
        <p className="small muted">
          Measured from the moment the user stops speaking or sends the message.{' '}
          {entry.audio === null
            ? 'No spoken version of this reply was requested.'
            : entry.audio.status === 'failed'
              ? `Voice generation failed (${entry.audio.payload.errorCode ?? 'error'}).`
              : `Voice: ${entry.audio.payload.provider}, ${String(entry.audio.payload.characterCount)} characters.`}
        </p>
        <BackgroundLatency entry={entry} />
      </Section>

      <Section title="What the Avatar was given" aside={<ContextAside entry={entry} />}>
        {turn.avatarContext === undefined ? (
          <Empty>No context snapshot was recorded for this turn.</Empty>
        ) : (
          <AvatarContextView context={turn.avatarContext} selection={turn.contextSelection} />
        )}
      </Section>

      <Section
        title="Knowledge retrieval (RAG)"
        aside={
          <>
            {plan !== undefined ? <Badge tone="accent">GM plan</Badge> : null}
            <span className="small muted">
              {chunkCount} chunks · {formatMs(turn.retrievalLatencyMs)}
            </span>
          </>
        }
      >
        {plan !== undefined ? (
          <KeyValues
            items={[
              [
                'GM retrieval plan',
                `from turn #${String(plan.generatedAfterTurn)}${plan.required ? ' (required)' : ''}`,
              ],
              ['Planned queries', <TextList items={plan.queries} empty="None" />],
              ['Required facts', <TextList items={plan.requiredFacts} empty="None" />],
            ]}
          />
        ) : null}
        <RetrievalView trace={trace} items={items} sourceNames={data.sourceNames} />
      </Section>

      <Section title="Game Master after this turn" aside={gmSummary(entry.gm, turn.hasGm)}>
        {entry.gm === null ? (
          <Empty>{turn.hasGm ? 'No GM result recorded yet.' : 'The GM is not enabled.'}</Empty>
        ) : (
          <GmRunView run={entry.gm} data={data} />
        )}
      </Section>

      <Section
        title="Memory updates"
        aside={<span className="small muted">{memoryAside(entry)}</span>}
      >
        {entry.memory.length === 0 ? (
          <Empty>
            Working memory is refreshed every third exchange and when a conversation closes or
            switches avatar.
          </Empty>
        ) : (
          entry.memory.map((run) => <MemoryRunView key={run.createdAt} run={run} />)
        )}
      </Section>
    </div>
  )
}

function ContextAside({ entry }: { entry: TurnEntry }): JSX.Element {
  const selection = entry.turn.contextSelection?.contextEngineSelection
  return (
    <>
      {entry.turn.avatarContext?.sections.directorNotes ? (
        <Badge tone="accent">director note</Badge>
      ) : null}
      {selection !== undefined && selection.trimmedSegmentCount > 0 ? (
        <Badge tone="warn">{selection.trimmedSegmentCount} trimmed</Badge>
      ) : null}
      {selection !== undefined ? (
        <span className="small muted">{selection.keptSegmentCount} segments kept</span>
      ) : null}
    </>
  )
}

function BackgroundLatency({ entry }: { entry: TurnEntry }): JSX.Element | null {
  const gmMs = entry.gm?.payload.totalLatencyMs ?? entry.gm?.payload.latencyMs
  const memoryMs = entry.memory.find((run) => run.payload?.latencyMs !== undefined)?.payload
    ?.latencyMs
  if (gmMs === undefined && memoryMs === undefined) return null
  return (
    <p className="small muted">
      Then, in the background (the user does not wait):
      {gmMs !== undefined ? ` Game Master ${formatMs(gmMs)}` : ''}
      {memoryMs !== undefined ? ` · memory refresh ${formatMs(memoryMs)}` : ''}
    </p>
  )
}

function memoryAside(entry: TurnEntry): string {
  if (entry.memory.length === 0) return 'none after this turn'
  return entry.memory.map((run) => run.status).join(', ')
}

export function BackgroundDetail({
  entry,
  data,
}: {
  entry: BackgroundEntry
  data: SessionData
}): JSX.Element {
  return (
    <div className="stack">
      <div className="card row spread">
        <h2>{backgroundLabel(entry)}</h2>
        <span className="small muted">{formatTime(entry.createdAt)}</span>
      </div>
      {entry.gm !== null ? (
        <Section defaultOpen title="Game Master" aside={gmSummary(entry.gm, true)}>
          <GmRunView run={entry.gm} data={data} />
        </Section>
      ) : null}
      {entry.memory.map((run) => (
        <Section
          key={run.createdAt}
          defaultOpen
          title="Working memory refresh"
          aside={<Badge tone={run.status === 'failed' ? 'error' : 'ok'}>{run.status}</Badge>}
        >
          <MemoryRunView run={run} />
        </Section>
      ))}
      {entry.consolidation.map((step) => (
        <Section
          key={step.createdAt}
          title="Episodic memory generated"
          aside={<Badge tone={step.status === 'failed' ? 'error' : 'ok'}>{step.status}</Badge>}
        >
          <ConsolidationView step={step} />
        </Section>
      ))}
    </div>
  )
}

function TurnHeader({ entry, data }: { entry: TurnEntry; data: SessionData }): JSX.Element {
  const { turn } = entry
  return (
    <div className="card stack">
      <div className="row spread">
        <h2>
          Turn #{turn.turnIndex} · {avatarName(data, turn.avatarId)}
        </h2>
        <span className="row small muted">
          {turn.inputMode === 'voice' ? <Badge>voice</Badge> : <Badge>text</Badge>}
          {formatTime(entry.createdAt)}
          <LangfuseTraceLink traceId={entry.id} />
        </span>
      </div>
      <div className="bubble user prewrap">
        {entry.userMessage?.content ?? <span className="muted">User message not found.</span>}
      </div>
      <div className="bubble prewrap">
        {entry.avatarMessage?.content ?? <span className="muted">Reply not found.</span>}
      </div>
      <p className="small muted">
        {turn.model} · {formatTokens(turn.inputTokens, turn.outputTokens)}
      </p>
    </div>
  )
}

// A streamed voice starts with its first audio chunk; older, non-streamed audio was only ready once
// fully generated.
function voiceWaitLabel(turn: TurnCompletedEventPayload, audio: AudioRun | null): string {
  const startMs = turnVoiceStartMs(turn, audio)
  if (startMs !== undefined) return ` · voice starts after ${formatMs(startMs)}`
  const readyMs = turnVoiceReadyMs(turn, audio)
  return readyMs === undefined ? '' : ` · voice ready after ${formatMs(readyMs)}`
}
