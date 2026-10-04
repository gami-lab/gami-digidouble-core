import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../../api/error'
import { sendMessage, startConversation } from '../../api/sessions'
import { formatMs, formatTime, truncate } from '../../debug/format'
import {
  backgroundLabel,
  type BackgroundEntry,
  type TimelineEntry,
  type TurnEntry,
} from '../../debug/session-timeline'
import { turnLatencySegments, turnWaitMs } from '../../debug/turn-latency'
import { Link } from '../../routing/Link'
import type { Route } from '../../routing/router'
import { Badge, Empty, ErrorText, LatencyBar } from '../../ui/ui'
import { avatarName } from './SessionHeader'
import { BackgroundDetail, TurnDetail } from './TurnDetail'
import type { SessionData } from './use-session-data'

type SessionRoute = Extract<Route, { name: 'session' }>

export function TurnsView({
  route,
  data,
  onChanged,
}: {
  route: SessionRoute
  data: SessionData
  onChanged: () => void
}): JSX.Element {
  const { timeline } = data
  // Without an explicit selection, follow the latest entry so live sessions stay in view.
  const selected =
    timeline.find((entry) => entry.id === route.turn) ?? timeline[timeline.length - 1] ?? null
  const scaleMs = Math.max(
    1,
    ...timeline.flatMap((entry) => (entry.kind === 'turn' ? [turnWaitMs(entry.turn)] : [])),
  )

  return (
    <div className="session-layout">
      <div className="stack">
        <TurnList
          entries={timeline}
          selectedId={selected?.id ?? null}
          route={route}
          data={data}
          scaleMs={scaleMs}
        />
        <Composer data={data} onSent={onChanged} />
      </div>
      <div className="stack">
        {selected === null ? <Empty>No turns yet. Send a message to start.</Empty> : null}
        {selected?.kind === 'turn' ? <TurnDetail entry={selected} data={data} /> : null}
        {selected?.kind === 'background' ? <BackgroundDetail entry={selected} data={data} /> : null}
      </div>
    </div>
  )
}

function TurnList({
  entries,
  selectedId,
  route,
  data,
  scaleMs,
}: {
  entries: TimelineEntry[]
  selectedId: string | null
  route: SessionRoute
  data: SessionData
  scaleMs: number
}): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const lastId = entries[entries.length - 1]?.id

  useEffect(() => {
    if (route.turn === null) listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [lastId, route.turn])

  return (
    <div className="turn-list" ref={listRef}>
      {entries.map((entry) => (
        <Link
          key={entry.id}
          to={{ ...route, turn: entry.id }}
          replace
          current={entry.id === selectedId}
          className={entry.kind === 'turn' ? 'turn-item' : 'turn-item background'}
        >
          {entry.kind === 'turn' ? (
            <TurnItem entry={entry} data={data} scaleMs={scaleMs} />
          ) : (
            <BackgroundItem entry={entry} data={data} />
          )}
        </Link>
      ))}
    </div>
  )
}

// eslint-disable-next-line complexity -- render-only branching
function TurnItem({
  entry,
  data,
  scaleMs,
}: {
  entry: TurnEntry
  data: SessionData
  scaleMs: number
}): JSX.Element {
  const { turn, gm } = entry
  const retrieval = turn.contextSelection?.retrieval?.includedCounts
  const chunkCount =
    retrieval === undefined ? 0 : retrieval.avatar_knowledge + retrieval.world + retrieval.media
  const trimmed = turn.contextSelection?.contextEngineSelection?.trimmedSegmentCount ?? 0
  const decision = gm?.payload.decision

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row spread small">
        <span>
          <strong>#{turn.turnIndex}</strong> {avatarName(data, turn.avatarId)}{' '}
          <span className="muted">{formatTime(entry.createdAt)}</span>
        </span>
        <span className="row">
          {turn.inputMode === 'voice' ? <Badge>voice</Badge> : null}
          <span className="mono">{formatMs(turnWaitMs(turn))}</span>
        </span>
      </div>
      <p className="line">
        {entry.userMessage?.content ?? <span className="muted">(message not loaded)</span>}
      </p>
      <p className="line muted small">{entry.avatarMessage?.content ?? ''}</p>
      <LatencyBar segments={turnLatencySegments(turn)} scaleMs={scaleMs} />
      <div className="row">
        <Badge tone={chunkCount > 0 ? 'accent' : 'neutral'}>RAG {chunkCount}</Badge>
        {decision !== undefined ? <Badge>GM {decision.dialogueMode}</Badge> : null}
        {decision?.routingAction !== undefined && decision.routingAction !== 'stay' ? (
          <Badge tone="warn">{decision.routingAction}</Badge>
        ) : null}
        {decision?.notesInjected === true ? <Badge tone="accent">note</Badge> : null}
        {gm?.status === 'error' ? <Badge tone="error">GM {gm.payload.errorCode}</Badge> : null}
        {turn.hasGm && gm === null ? <Badge>GM pending</Badge> : null}
        {entry.memory.some((run) => run.status === 'ok') ? <Badge tone="ok">memory</Badge> : null}
        {entry.memory.some((run) => run.status === 'failed') ? (
          <Badge tone="error">memory failed</Badge>
        ) : null}
        {trimmed > 0 ? <Badge tone="warn">{trimmed} trimmed</Badge> : null}
      </div>
    </div>
  )
}

function BackgroundItem({
  entry,
  data,
}: {
  entry: BackgroundEntry
  data: SessionData
}): JSX.Element {
  const label = backgroundLabel(entry)
  const failed =
    entry.gm?.status === 'error' ||
    entry.memory.some((run) => run.status === 'failed') ||
    entry.consolidation.some((step) => step.status === 'failed')
  const conversation = data.conversations.find(
    (item) => item.conversationId === entry.conversationId,
  )

  return (
    <div className="row spread small">
      <span>
        <strong>{label}</strong>
        {conversation !== undefined ? (
          <span className="muted"> · {avatarName(data, conversation.avatarId)}</span>
        ) : null}
      </span>
      <span className="row">
        {failed ? <Badge tone="error">failed</Badge> : null}
        <span className="muted">{formatTime(entry.createdAt)}</span>
      </span>
    </div>
  )
}

function Composer({ data, onSent }: { data: SessionData; onSent: () => void }): JSX.Element {
  const [text, setText] = useState('')
  const [avatarId, setAvatarId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const session = data.inspect.session
  const active = data.conversations.find(
    (conversation) =>
      conversation.status === 'active' && conversation.avatarId === session.activeAvatarId,
  )

  function act(work: () => Promise<unknown>): void {
    setIsBusy(true)
    setError(null)
    work()
      .then(() => {
        setText('')
        onSent()
      })
      .catch((actError: unknown) => {
        setError(formatApiError(actError, 'Request failed'))
      })
      .finally(() => {
        setIsBusy(false)
      })
  }

  if (session.status !== 'active')
    return <Empty>Session is {session.status}; it cannot take new turns.</Empty>

  if (active === undefined) {
    const candidates = data.avatars.filter(
      (avatar) =>
        avatar.status === 'active' && (session.unlockedAvatarIds ?? []).includes(avatar.avatarId),
    )
    return (
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          act(() => startConversation(session.sessionId, avatarId))
        }}
      >
        <select
          aria-label="Avatar"
          value={avatarId}
          onChange={(event) => {
            setAvatarId(event.target.value)
          }}
          style={{ flex: 1 }}
        >
          <option value="">Start a conversation with…</option>
          {candidates.map((avatar) => (
            <option key={avatar.avatarId} value={avatar.avatarId}>
              {avatar.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isBusy || avatarId === ''}>
          Start
        </button>
        <ErrorText error={error} />
      </form>
    )
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        act(() => sendMessage(active.conversationId, text.trim()))
      }}
    >
      <div className="composer">
        <input
          aria-label="Message"
          placeholder={`Message ${avatarName(data, active.avatarId)} (text turn)`}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
        <button type="submit" className="primary" disabled={isBusy || text.trim() === ''}>
          {isBusy ? 'Waiting…' : 'Send'}
        </button>
      </div>
      <ErrorText error={error} />
      {isBusy ? <p className="small muted">{truncate(text, 80)}</p> : null}
    </form>
  )
}
